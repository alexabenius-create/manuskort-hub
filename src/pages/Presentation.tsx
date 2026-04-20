import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useOrientation } from "@/hooks/useOrientation";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePresentationTimer } from "@/hooks/usePresentationTimer";
import { useCardTimers } from "@/hooks/useCardTimers";
import { PresentationTopbar } from "@/components/presentation/PresentationTopbar";
import { PresentationFooter } from "@/components/presentation/PresentationFooter";
import { PresentationCard } from "@/components/presentation/PresentationCard";
import { PresentationMobile } from "@/components/presentation/mobile/PresentationMobile";
import { MobileFirstRunHint } from "@/components/presentation/mobile/MobileFirstRunHint";
import { CountdownOverlay } from "@/components/presentation/CountdownOverlay";
import { RotateDeviceOverlay } from "@/components/presentation/RotateDeviceOverlay";

import { PresentationStartMenu, type ViewMode, type FocusStyle } from "@/components/presentation/PresentationStartMenu";
import { ScrollingTeleprompter, computeRequiredSpeedFactor } from "@/components/presentation/ScrollingTeleprompter";
import { HelpOverlay } from "@/components/presentation/HelpOverlay";
import { SEO } from "@/components/SEO";
import { scanCardsForPlaceholders } from "@/lib/profilePlaceholders";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HELP_SEEN_KEY = "presentation-help-seen-v1";
const MOBILE_HINT_SEEN_KEY = "presentation-mobile-hint-seen-v1";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { Panelist } from "@/hooks/usePanelists";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"] & {
  target_duration_seconds: number | null;
};
type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card: boolean;
};

const SIZE_OFFSET_KEY = (id: string) => `presentation-size-offset:${id}`;

export default function Presentation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [panelists, setPanelists] = useState<Panelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  // Mobil-v2: anteckningsöverlägg är dolt vid start; bara ikonen visas. Read-only på mobil.
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  // Mobil-v2: första-gången-tips visas en gång per enhet.
  const [showMobileHint, setShowMobileHint] = useState(false);
  const [sizeOffset, setSizeOffset] = useState(0);
  const [xVisible, setXVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(true);
  const [startMode, setStartMode] = useState<"countdown" | "instant" | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [focusStyle, setFocusStyle] = useState<FocusStyle>("line");
  const [speedFactor, setSpeedFactor] = useState(1.0);
  const [speedChip, setSpeedChip] = useState<{ value: number; ts: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [overdueDismissedIds, setOverdueDismissedIds] = useState<Set<string>>(new Set());
  const [pendingStart, setPendingStart] = useState<null | {
    mode: "countdown" | "instant";
    viewMode: ViewMode;
    focusStyle: FocusStyle;
    placeholders: string[];
  }>(null);
  const xTimerRef = useRef<number | null>(null);
  const hasEnteredFullscreenRef = useRef(false);

  const wakeLockStatus = useWakeLock(true);
  const isMobile = useIsMobile();
  const orientation = useOrientation();
  const presentationActive = !menuOpen;
  // Lås till liggande på mobil när presentation pågår — fungerar på Android Chrome,
  // no-op på iOS Safari (där visar vi RotateDeviceOverlay i stället).
  useFullscreen(true, isMobile && presentationActive);
  const [rotateDismissed, setRotateDismissed] = useState(false);
  const showRotateOverlay = isMobile && presentationActive && orientation === "portrait" && !rotateDismissed;
  // Återställ dismiss när användaren vrider till liggande, så overlay återkommer om de vrider tillbaka
  useEffect(() => {
    if (orientation === "landscape") setRotateDismissed(false);
  }, [orientation]);

  // Sätt body/html till svart medan presentation är monterad — undviker vita iOS safe-area-barer.
  // Lägg också min-height + 1px så iOS Safari ser sidan som scrollbar och kan kollapsa URL-baren.
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    const prevBodyMinH = document.body.style.minHeight;
    document.body.style.backgroundColor = "#09090b";
    document.documentElement.style.backgroundColor = "#09090b";
    document.body.style.minHeight = "calc(100dvh + 1px)";
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
      document.body.style.minHeight = prevBodyMinH;
    };
  }, []);

  // Återställ sizeOffset från sessionStorage
  useEffect(() => {
    if (!id) return;
    try {
      const raw = sessionStorage.getItem(SIZE_OFFSET_KEY(id));
      if (raw) setSizeOffset(parseInt(raw, 10) || 0);
    } catch { /* ignore */ }
  }, [id]);

  const handleSizeChange = (offset: number) => {
    setSizeOffset(offset);
    if (id) {
      try { sessionStorage.setItem(SIZE_OFFSET_KEY(id), String(offset)); } catch { /* ignore */ }
    }
  };

  // Wake Lock-info en gång om det saknas
  useEffect(() => {
    if (wakeLockStatus === "unsupported") {
      toast("Skärmen kan slockna under presentationen", {
        description: "Din webbläsare stöder inte att hålla skärmen vaken. Sätt skärmtimeout till högsta värdet i systeminställningarna.",
        duration: 6000,
      });
    }
  }, [wakeLockStatus]);

  // Ladda data
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [mRes, cRes, pRes] = await Promise.all([
        supabase.from("manuscripts").select("*").eq("id", id).maybeSingle(),
        supabase.from("cards").select("*").eq("manuscript_id", id).order("position"),
        supabase.from("panelists").select("*").eq("manuscript_id", id).order("position"),
      ]);
      if (mRes.error || !mRes.data) {
        toast.error("Kunde inte ladda manuset", { description: mRes.error?.message });
        navigate("/bibliotek");
        return;
      }
      setManuscript(mRes.data as Manuscript);
      setCards((cRes.data ?? []) as Card[]);
      setPanelists((pRes.data ?? []) as Panelist[]);
      setLoading(false);
    })();
  }, [id, navigate]);

  // Tidsmodul
  const targetSeconds = manuscript?.target_duration_seconds ?? 0;
  const timerMode = (manuscript?.time_format === "elapsed" ? "elapsed" : "clock") as "clock" | "elapsed";
  const timerEnabled = !loading && !!manuscript && startMode !== null;
  const timer = usePresentationTimer({
    manuscriptId: id ?? "none",
    targetSeconds,
    mode: timerMode,
    enabled: timerEnabled,
    countdownSeconds: startMode === "instant" ? 0 : 3,
  });

  const handleModeChange = useCallback(async (next: "clock" | "elapsed") => {
    if (!manuscript) return;
    setManuscript({ ...manuscript, time_format: next });
    await supabase.from("manuscripts").update({ time_format: next }).eq("id", manuscript.id);
  }, [manuscript]);

  // Exit-flöde
  const exit = useCallback(() => {
    timer.clearPersisted();
    hasEnteredFullscreenRef.current = false;
    if (id) {
      try { sessionStorage.removeItem(SIZE_OFFSET_KEY(id)); } catch { /* ignore */ }
    }
    navigate(`/manus/${id}`);
  }, [id, navigate, timer]);

  // Hastighetskontroll i scroll-läge — delas mellan tangenter och knappar
  const handleSpeedUp = useCallback(() => {
    setSpeedFactor((s) => {
      const next = Math.min(3.0, +(s + 0.1).toFixed(2));
      setSpeedChip({ value: next, ts: Date.now() });
      return next;
    });
  }, []);
  const handleSpeedDown = useCallback(() => {
    setSpeedFactor((s) => {
      const next = Math.max(0.25, +(s - 0.1).toFixed(2));
      setSpeedChip({ value: next, ts: Date.now() });
      return next;
    });
  }, []);
  const handleSpeedReset = useCallback(() => {
    setSpeedFactor(1.0);
    setSpeedChip({ value: 1.0, ts: Date.now() });
  }, []);

  // Esc + fullscreenchange
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menuOpen) return; // Menyn hanterar sina egna tangenter

      // Ignorera tangenter när användaren skriver i ett input/textarea/contentEditable
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        e.preventDefault();
        if (helpOpen) { setHelpOpen(false); return; }
        exit();
        return;
      }

      if (isEditable) return;

      // Hjälp-overlay: ? eller H öppnar/stänger
      if (e.key === "?" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      // Om hjälpen är öppen, blockera andra genvägar
      if (helpOpen) return;

      // Scroll-läge: hastighet via +/-/R, piltangenter ignoreras (undvik konflikt med klickare)
      if (viewMode === "scroll") {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          handleSpeedUp();
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          handleSpeedDown();
          return;
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          handleSpeedReset();
          return;
        }
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          handlePanic();
          return;
        }
        // Pil-tangenter och space ignoreras i scroll-läge
        return;
      }

      // Cards-läge: Navigation
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handlePanic();
      }
    };

    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (isFs) hasEnteredFullscreenRef.current = true;
      else if (hasEnteredFullscreenRef.current) exit();
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exit, cards.length, currentIndex, menuOpen, viewMode, helpOpen]);

  // Auto-visa hjälp första gången användaren startar en presentation
  useEffect(() => {
    if (menuOpen) return;
    try {
      if (!localStorage.getItem(HELP_SEEN_KEY)) {
        setHelpOpen(true);
        localStorage.setItem(HELP_SEEN_KEY, "1");
      }
    } catch { /* ignore */ }
  }, [menuOpen]);

  // Mobil: göm bara X (och tillvalsknappar) efter 2s — footer är ALLTID synlig.
  useEffect(() => {
    if (menuOpen || !isMobile) return;
    setXVisible(true);
    if (xTimerRef.current) window.clearTimeout(xTimerRef.current);
    xTimerRef.current = window.setTimeout(() => setXVisible(false), 2000);
    return () => {
      if (xTimerRef.current) window.clearTimeout(xTimerRef.current);
    };
  }, [menuOpen, isMobile, currentIndex, orientation]);

  // iOS Safari URL-bar trick: scrolla 1px så Safari kollapsar sin chrome.
  // Triggas även vid orientationsbyte (extra fördröjning för rotationsanimation).
  useEffect(() => {
    if (menuOpen || !isMobile) return;
    const trigger = () => window.scrollTo(0, 1);
    trigger();
    const t1 = window.setTimeout(trigger, 100);
    const t2 = window.setTimeout(trigger, 500);
    const t3 = window.setTimeout(trigger, 1500);
    const t4 = window.setTimeout(trigger, 300); // efter rotationsanim
    const onResize = () => trigger();
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen, isMobile, orientation]);

  // Återställ auto-hide-timer vid pointermove (iPad/trackpad/Pencil)
  useEffect(() => {
    if (menuOpen || !isMobile) return;
    const onMove = () => {
      setXVisible(true);
      if (xTimerRef.current) window.clearTimeout(xTimerRef.current);
      xTimerRef.current = window.setTimeout(() => setXVisible(false), 3000);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [menuOpen, isMobile]);

  // Navigation
  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(cards.length - 1, i + 1));
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  // Panik — hoppa till nästa panik-kort, eller loopa till första
  const handlePanic = useCallback(() => {
    const panicCards = cards
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => c.is_panic_card);
    if (panicCards.length === 0) return;
    const after = panicCards.find(({ idx }) => idx > currentIndex);
    const target = after ?? panicCards[0];
    setCurrentIndex(target.idx);
  }, [cards, currentIndex]);

  // Anteckningar — debounced spara till Supabase
  const notesSaveTimers = useRef<Map<string, number>>(new Map());
  const handleNotesChange = useCallback((cardId: string, notes: string) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, notes } : c)));
    const timers = notesSaveTimers.current;
    const existing = timers.get(cardId);
    if (existing) window.clearTimeout(existing);
    const t = window.setTimeout(async () => {
      timers.delete(cardId);
      const { error } = await supabase.from("cards").update({ notes }).eq("id", cardId);
      if (error) toast.error("Kunde inte spara anteckningar", { description: error.message });
    }, 600);
    timers.set(cardId, t);
  }, []);

  // Spara väntande anteckningar vid unmount/exit
  useEffect(() => {
    const timers = notesSaveTimers.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Touch — svep + tap-zoner. Fredar interaktiva element och topbar/footer-zoner.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;

    // Visa X i 3 sek vid tap
    setXVisible(true);
    if (xTimerRef.current) window.clearTimeout(xTimerRef.current);
    xTimerRef.current = window.setTimeout(() => setXVisible(false), 3000);

    // Hoppa över navigation om tap/svep landade på ett interaktivt element
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, [role="button"], [contenteditable="true"]')) {
      return;
    }

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
      if (dx < 0) goNext(); else goPrev();
      return;
    }

    // Tap (ingen sweep) → tap-zon. Fredar topp 40px och botten 40px (kompakta mobil-barer).
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
      const h = window.innerHeight;
      if (t.clientY < 40 || t.clientY > h - 40) return;
      const w = window.innerWidth;
      if (t.clientX > w / 2) goNext(); else goPrev();
    }
  };

  // Tap på desktop med klick på huvudytan — bara om INTE på interaktiv zon
  // (vi använder bara touch-handlers; mus-klick går via knapparna)

  // Per-kort faktisk tid — ackumuleras när man bläddrar mellan kort.
  const currentCardId = cards[currentIndex]?.id;
  const cardTimers = useCardTimers(
    currentCardId,
    timerEnabled && timer.countdown === 0,
    timer.isPaused,
  );
  const cardElapsedSeconds = cardTimers.getCardElapsed(currentCardId);

  // Mobil-v2 routing — beräknas före early returns så hooks-ordningen är stabil.
  const useMobileV2 = isMobile && !menuOpen && viewMode === "cards";

  // Visa första-gången-tips när mobil-v2 visas första gången per enhet.
  useEffect(() => {
    if (!useMobileV2) return;
    try {
      if (localStorage.getItem(MOBILE_HINT_SEEN_KEY)) return;
    } catch { /* ignore */ }
    setShowMobileHint(true);
  }, [useMobileV2]);

  const dismissMobileHint = useCallback(() => {
    setShowMobileHint(false);
    try { localStorage.setItem(MOBILE_HINT_SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);

  if (loading || !manuscript) {
    return (
      <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-500 text-[14px]">Laddar manus…</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-zinc-300 text-[16px]">Inga kort att visa.</p>
        <button onClick={exit} className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[13px]">
          Tillbaka till editorn
        </button>
      </div>
    );
  }

  const current = cards[currentIndex];
  const next = cards[currentIndex + 1];
  const hasPanicCards = cards.some((c) => c.is_panic_card);

  return (
    <>
    <SEO title="Presentera – Manuskort" noindex nofollow />
    <div
      key={isMobile ? orientation : "desktop"}
      className="fixed inset-0 bg-zinc-800 text-zinc-100 overflow-hidden flex flex-col"
      style={{ height: "100dvh", minHeight: "calc(100dvh + 1px)" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {useMobileV2 ? (
        <PresentationMobile
          manuscript={manuscript}
          cards={cards}
          panelists={panelists}
          currentIndex={currentIndex}
          current={current}
          next={next}
          hasPanicCards={hasPanicCards}
          timer={timer}
          cardTimers={cardTimers}
          cardElapsedSeconds={cardElapsedSeconds}
          sizeOffset={sizeOffset}
          onSizeChange={handleSizeChange}
          showNotes={mobileNotesOpen}
          onToggleNotes={() => setMobileNotesOpen((s) => !s)}
          onNotesChange={handleNotesChange}
          onExit={exit}
          onPanic={handlePanic}
          onModeChange={handleModeChange}
          onHelpOpen={() => setHelpOpen(true)}
          wakeLockStatus={wakeLockStatus}
          xVisible={xVisible}
          onCenterTap={() => {
            setXVisible(true);
            if (xTimerRef.current) window.clearTimeout(xTimerRef.current);
            xTimerRef.current = window.setTimeout(() => setXVisible(false), 3000);
          }}
          onNext={goNext}
          onPrev={goPrev}
          timerMode={timerMode}
          overdueDismissedIds={overdueDismissedIds}
          onDismissOverdue={(cardId) =>
            setOverdueDismissedIds((prev) => {
              const next = new Set(prev);
              next.add(cardId);
              return next;
            })
          }
        />
      ) : (
        <>
      <PresentationTopbar
        mode={timerMode}
        onModeChange={handleModeChange}
        direction={timer.direction}
        onDirectionToggle={timer.toggleDirection}
        isPaused={timer.isPaused}
        onPauseToggle={timer.togglePause}
        elapsedSeconds={timer.elapsedSeconds}
        remainingSeconds={timer.remainingSeconds}
        targetSeconds={timer.targetSeconds}
        now={timer.now}
        isWarning={timer.isWarning}
        isOverdue={timer.isOverdue}
        wakeLockStatus={wakeLockStatus}
        onExit={exit}
        xVisible={xVisible}
        countdownActive={timer.countdown > 0}
      />

      {/* Diskret hjälp-knapp — desktop alltid, mobil endast när xVisible (tap i mitten) */}
      {!menuOpen && (!isMobile || xVisible) && (
        <button
          onClick={() => setHelpOpen(true)}
          className={`fixed z-30 rounded-full bg-zinc-900/80 backdrop-blur border border-zinc-800/60 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all font-mono shadow-lg shadow-black/40 ${
            isMobile
              ? "top-1.5 right-10 w-7 h-7 text-[12px]"
              : "bottom-6 right-6 w-11 h-11 text-[16px]"
          }`}
          aria-label="Visa hjälp (?)"
          title="Visa hjälp (?)"
        >
          ?
        </button>
      )}



      <main className="flex-1 min-h-0 pt-9 md:pt-24 pb-9 md:pb-24 px-0 md:px-10 relative">
        <div
          className={`h-full w-full bg-black md:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
            typeof current.target_seconds === "number" &&
            current.target_seconds > 0 &&
            cardElapsedSeconds > current.target_seconds &&
            !overdueDismissedIds.has(current.id)
              ? "ring-4 ring-red-500 shadow-red-500/40"
              : "shadow-black/40"
          }`}
        >
          {!menuOpen && viewMode === "cards" && (
            <PresentationCard
              card={current}
              panelists={panelists}
              textSize={(manuscript.text_size as "sm" | "md" | "lg") ?? "md"}
              sizeOffset={sizeOffset}
              showNotes={showNotes}
              onToggleNotes={() => setShowNotes((s) => !s)}
              onNotesChange={(notes) => handleNotesChange(current.id, notes)}
            />
          )}
          {!menuOpen && viewMode === "scroll" && (
            <ScrollingTeleprompter
              cards={cards}
              panelists={panelists}
              textSize={(manuscript.text_size as "sm" | "md" | "lg") ?? "md"}
              sizeOffset={sizeOffset}
              focusStyle={focusStyle}
              elapsedSeconds={timer.elapsedSeconds}
              targetSeconds={timer.targetSeconds}
              isPaused={timer.isPaused}
              countdownActive={timer.countdown > 0}
              speedFactor={speedFactor}
              onSpeedUp={handleSpeedUp}
              onSpeedDown={handleSpeedDown}
              onSpeedReset={handleSpeedReset}
            />
          )}
        </div>
      </main>

      {viewMode === "cards" && (
        <PresentationFooter
          current={current}
          next={next}
          index={currentIndex}
          total={cards.length}
          hasPanicCards={hasPanicCards}
          onPanic={handlePanic}
          cardElapsedSeconds={cardElapsedSeconds}
          cardTargetSeconds={current.target_seconds ?? null}
          isOverdueDismissed={overdueDismissedIds.has(current.id)}
          onDismissOverdue={() =>
            setOverdueDismissedIds((prev) => {
              const next = new Set(prev);
              next.add(current.id);
              return next;
            })
          }
          timeFormat={timerMode}
          sizeOffset={sizeOffset}
          onSizeChange={handleSizeChange}
          visible={isMobile ? true : xVisible}
          totalRemainingSeconds={timer.remainingSeconds}
          totalTimerMode={timerMode}
          totalNow={timer.now}
          isPaused={timer.isPaused}
          onPauseToggle={timer.togglePause}
          countdownActive={timer.countdown > 0}
          showZoomButtons={xVisible}
        />
      )}
        </>
      )}

      {/* Speed-chip i scroll-läge */}
      {viewMode === "scroll" && speedChip && Date.now() - speedChip.ts < 2000 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-2xl bg-zinc-900/90 backdrop-blur text-zinc-100 font-mono text-[20px] tabular-nums animate-in fade-in duration-200">
          {speedChip.value.toFixed(2)}×
        </div>
      )}

      {timerEnabled && timer.countdown > 0 && <CountdownOverlay value={timer.countdown} />}

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} viewMode={viewMode} />

      {menuOpen && (
        <PresentationStartMenu
          estimatedSpeedFactor={1.0}
          onStartCountdown={(opts) => {
            const placeholders = scanCardsForPlaceholders(cards);
            if (placeholders.length > 0) {
              setPendingStart({ mode: "countdown", viewMode: opts.viewMode, focusStyle: opts.focusStyle, placeholders });
              return;
            }
            setViewMode(opts.viewMode);
            setFocusStyle(opts.focusStyle);
            setStartMode("countdown");
            setMenuOpen(false);
          }}
          onStartInstant={(opts) => {
            const placeholders = scanCardsForPlaceholders(cards);
            if (placeholders.length > 0) {
              setPendingStart({ mode: "instant", viewMode: opts.viewMode, focusStyle: opts.focusStyle, placeholders });
              return;
            }
            setViewMode(opts.viewMode);
            setFocusStyle(opts.focusStyle);
            setStartMode("instant");
            setMenuOpen(false);
          }}
          onExit={exit}
        />
      )}

      <AlertDialog
        open={!!pendingStart}
        onOpenChange={(o) => { if (!o) setPendingStart(null); }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-semibold">
              Oersatta platshållare hittades
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-[14px]">
                <p>
                  Manuset innehåller {pendingStart?.placeholders.length}{" "}
                  {pendingStart?.placeholders.length === 1 ? "platshållare" : "platshållare"} som inte är ifyllda.
                  Dessa kommer synas under presentationen:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pendingStart?.placeholders.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center text-[12px] font-mono px-2.5 py-1 rounded-full bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/30"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <p className="text-muted-foreground">
                  Du kan gå tillbaka och fixa dem med Hitta &amp; ersätt, eller fortsätta ändå.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" onClick={() => {
              setPendingStart(null);
              exit();
            }}>
              Tillbaka och fixa
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white"
              onClick={() => {
                if (!pendingStart) return;
                setViewMode(pendingStart.viewMode);
                setFocusStyle(pendingStart.focusStyle);
                setStartMode(pendingStart.mode);
                setMenuOpen(false);
                setPendingStart(null);
              }}
            >
              Fortsätt ändå
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showRotateOverlay && (
        <RotateDeviceOverlay onContinueAnyway={() => setRotateDismissed(true)} />
      )}

      {useMobileV2 && showMobileHint && !showRotateOverlay && (
        <MobileFirstRunHint onDismiss={dismissMobileHint} />
      )}
    </div>
    </>
  );
}
