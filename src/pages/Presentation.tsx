import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useFullscreen } from "@/hooks/useFullscreen";
import { usePresentationTimer } from "@/hooks/usePresentationTimer";
import { PresentationTopbar } from "@/components/presentation/PresentationTopbar";
import { PresentationFooter } from "@/components/presentation/PresentationFooter";
import { PresentationCard } from "@/components/presentation/PresentationCard";
import { CountdownOverlay } from "@/components/presentation/CountdownOverlay";
import { PresentationStartMenu, type ViewMode, type FocusStyle } from "@/components/presentation/PresentationStartMenu";
import { ScrollingTeleprompter, computeRequiredSpeedFactor } from "@/components/presentation/ScrollingTeleprompter";
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
  const [sizeOffset, setSizeOffset] = useState(0);
  const [xVisible, setXVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(true);
  const [startMode, setStartMode] = useState<"countdown" | "instant" | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [focusStyle, setFocusStyle] = useState<FocusStyle>("line");
  const [speedFactor, setSpeedFactor] = useState(1.0);
  const [speedChip, setSpeedChip] = useState<{ value: number; ts: number } | null>(null);
  const xTimerRef = useRef<number | null>(null);
  const hasEnteredFullscreenRef = useRef(false);

  const wakeLockStatus = useWakeLock(true);
  useFullscreen(true);

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
        navigate("/");
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
  const timerEnabled = !loading && !!manuscript && targetSeconds > 0 && startMode !== null;
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
        exit();
        return;
      }

      if (isEditable) return;

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
  }, [exit, cards.length, currentIndex, menuOpen, viewMode]);

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

  // Touch — svep + tap-zoner
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

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
      if (dx < 0) goNext(); else goPrev();
      return;
    }

    // Tap (ingen sweep) → tap-zon
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
      const w = window.innerWidth;
      if (t.clientX > w / 2) goNext(); else goPrev();
    }
  };

  // Tap på desktop med klick på huvudytan — bara om INTE på interaktiv zon
  // (vi använder bara touch-handlers; mus-klick går via knapparna)

  // Per-kort start-elapsed (för progress-ring): summera planerade tider för tidigare kort
  const cardStartedAtElapsed = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < currentIndex; i++) {
      const c = cards[i];
      const start = c.start_time;
      const end = c.end_time;
      // Försök beräkna planerad tid för kortet
      if (start && end) {
        const ms = parseInt(end.split(":").reduce((a, p) => a * 60 + parseInt(p, 10), 0).toString())
                 - parseInt(start.split(":").reduce((a, p) => a * 60 + parseInt(p, 10), 0).toString());
        if (ms > 0) sum += ms;
      }
    }
    return sum;
  }, [cards, currentIndex]);

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
    <div
      className="fixed inset-0 bg-zinc-800 text-zinc-100 overflow-hidden flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
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

      <main className="flex-1 min-h-0 pt-44 pb-44 px-6 md:px-10 relative">
        <div className="h-full w-full bg-black rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
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
          elapsedSeconds={timer.elapsedSeconds}
          cardStartedAtElapsedSeconds={cardStartedAtElapsed}
          timeFormat={timerMode}
          sizeOffset={sizeOffset}
          onSizeChange={handleSizeChange}
        />
      )}

      {/* Speed-chip i scroll-läge */}
      {viewMode === "scroll" && speedChip && Date.now() - speedChip.ts < 2000 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-2xl bg-zinc-900/90 backdrop-blur text-zinc-100 font-mono text-[20px] tabular-nums animate-in fade-in duration-200">
          {speedChip.value.toFixed(2)}×
        </div>
      )}

      {timerEnabled && timer.countdown > 0 && <CountdownOverlay value={timer.countdown} />}

      {menuOpen && (
        <PresentationStartMenu
          estimatedSpeedFactor={1.0}
          onStartCountdown={(opts) => {
            setViewMode(opts.viewMode);
            setFocusStyle(opts.focusStyle);
            setStartMode("countdown");
            setMenuOpen(false);
          }}
          onStartInstant={(opts) => {
            setViewMode(opts.viewMode);
            setFocusStyle(opts.focusStyle);
            setStartMode("instant");
            setMenuOpen(false);
          }}
          onExit={exit}
        />
      )}
    </div>
  );
}
