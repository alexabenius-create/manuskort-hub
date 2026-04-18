import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { LIMITS } from "@/lib/tierLimits";
import { useImportStore } from "@/lib/import/importStore";
import { UploadZone } from "@/components/import/UploadZone";
import { SettingsForm } from "@/components/import/SettingsForm";
import { PreviewCardItem } from "@/components/import/PreviewCardItem";
import { SpeakerMappingPanel } from "@/components/import/SpeakerMappingPanel";
import {
  detectFileKind,
  parseFile,
} from "@/lib/import/parseDocument";
import {
  autoDetectStrategy,
  buildCards,
  detectedSpeakerNames,
} from "@/lib/import/buildCards";
import {
  WORDS_PER_CARD_DEFAULT,
  exceedsThreshold,
} from "@/lib/import/splitStrategies";
import type { PreviewCard } from "@/lib/import/splitStrategies";
import { PANELIST_PALETTE } from "@/lib/panelistColors";
import { wordCount, estimateSeconds, formatDuration, stripHtml } from "@/lib/wordCount";

export default function Import() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const limits = LIMITS[tier];
  const store = useImportStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const importBlocked = !tierLoading && !limits.docxImport;

  // Hantera fil från Library drop-zone (skickas via location.state)
  useEffect(() => {
    const stateFile = (location.state as { file?: File } | null)?.file;
    if (stateFile && !store.file) {
      handleFileSelected(stateFile);
      // Rensa state så reload inte triggar igen
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // beforeunload-skydd i steg 2 när användaren har justerat
  useEffect(() => {
    if (step !== 2 || !store.dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, store.dirty]);

  const handleFileSelected = async (file: File) => {
    setParsing(true);
    store.setFile(file);
    const kind = detectFileKind(file);
    store.setFileKind(kind === "docx" || kind === "txt" ? kind : null);

    try {
      const result = await parseFile(file);
      store.setRawBlocks(result.blocks);
      store.setDetectedTitle(result.title);
      store.setSkipped(result.skipped);

      // Förfyll titel
      const filename = file.name.replace(/\.(docx|txt)$/i, "");
      store.setTitle(result.title || filename);

      // Auto-välj strategi
      const auto = autoDetectStrategy(result.blocks);
      store.setStrategy(auto);
      store.setWordsPerCard(WORDS_PER_CARD_DEFAULT[store.textSize]);
    } catch (e) {
      toast({
        title: "Filen kunde inte läsas",
        description: e instanceof Error ? e.message : "Försök spara om från Word.",
        variant: "destructive",
      });
      store.setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const hasHeadings = useMemo(
    () =>
      store.rawBlocks.some(
        (b) => b.type === "heading" && (b.level === 1 || b.level === 2)
      ),
    [store.rawBlocks]
  );

  const goToPreview = () => {
    if (!store.file || store.rawBlocks.length === 0) {
      toast({ title: "Ladda upp en fil först", variant: "destructive" });
      return;
    }
    if (!store.title.trim()) {
      toast({ title: "Ange en titel", variant: "destructive" });
      return;
    }

    // Bygg kort + initiera talar-mappning
    const tempIds = new Map<string, string>();
    const cards = buildCards({
      blocks: store.rawBlocks,
      strategy: store.strategy,
      wordsPerCard: store.wordsPerCard,
      textSize: store.textSize,
      speakerTempIds: tempIds,
    });

    const detectedNames = detectedSpeakerNames(store.rawBlocks);
    const speakerMappings = detectedNames.map((name, i) => ({
      detectedName: name,
      tempId: tempIds.get(name) || `tmp:${name}`,
      action: "new" as const,
      color: PANELIST_PALETTE[i % PANELIST_PALETTE.length],
    }));

    store.speakerTempIds.clear();
    tempIds.forEach((v, k) => store.speakerTempIds.set(k, v));
    store.setCards(cards);
    store.setSpeakers(speakerMappings);
    setStep(2);
  };

  // Re-bygg kort när strategi/ordantal ändras i steg 2 (men endast om inte dirty)
  const rebuildCards = () => {
    if (store.dirty) {
      if (
        !confirm(
          "Att byta strategi rensar dina manuella ändringar. Fortsätt?"
        )
      )
        return;
    }
    const tempIds = new Map<string, string>();
    const cards = buildCards({
      blocks: store.rawBlocks,
      strategy: store.strategy,
      wordsPerCard: store.wordsPerCard,
      textSize: store.textSize,
      speakerTempIds: tempIds,
    });
    store.setCards(cards);
    // Markera ej dirty efter omstart
    useImportStore.setState({ dirty: false });
  };

  // Kort-actions
  const updateCard = (idx: number, patch: Partial<PreviewCard>) => {
    const next = [...store.cards];
    next[idx] = { ...next[idx], ...patch };
    store.setCards(next);
    store.markDirty();
  };

  const removeCard = (idx: number) => {
    const next = store.cards.filter((_, i) => i !== idx);
    store.setCards(next);
    store.markDirty();
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= store.cards.length) return;
    const next = [...store.cards];
    [next[idx], next[target]] = [next[target], next[idx]];
    store.setCards(next);
    store.markDirty();
  };

  const mergeWith = (idx: number, otherIdx: number) => {
    if (otherIdx < 0 || otherIdx >= store.cards.length) return;
    const a = store.cards[Math.min(idx, otherIdx)];
    const b = store.cards[Math.max(idx, otherIdx)];
    const mergedHtml = a.contentHtml + b.contentHtml;
    const merged: PreviewCard = {
      ...a,
      contentHtml: mergedHtml,
      paragraphsHtml: [...a.paragraphsHtml, ...b.paragraphsHtml],
      wordCount: wordCount(mergedHtml),
    };
    const next = store.cards.filter((_, i) => i !== Math.max(idx, otherIdx));
    next[Math.min(idx, otherIdx)] = merged;
    store.setCards(next);
    store.markDirty();
  };

  const splitAt = (idx: number, paragraphIdx: number) => {
    const c = store.cards[idx];
    const firstParas = c.paragraphsHtml.slice(0, paragraphIdx);
    const restParas = c.paragraphsHtml.slice(paragraphIdx);
    if (firstParas.length === 0 || restParas.length === 0) return;

    const firstHtml = firstParas.join("");
    const restHtml = restParas.join("");
    const titleFromText = (h: string) =>
      stripHtml(h).split(/[.!?…]/)[0].slice(0, 60).trim() || "Kort";

    const a: PreviewCard = {
      ...c,
      contentHtml: firstHtml,
      paragraphsHtml: firstParas,
      wordCount: wordCount(firstHtml),
    };
    const b: PreviewCard = {
      id: `${c.id}_b`,
      title: titleFromText(restHtml),
      contentHtml: restHtml,
      paragraphsHtml: restParas,
      wordCount: wordCount(restHtml),
      speakerName: c.speakerName,
    };
    const next = [...store.cards];
    next.splice(idx, 1, a, b);
    store.setCards(next);
    store.markDirty();
  };

  // Commit via RPC
  const commit = async () => {
    if (!user) return;
    setCommitting(true);

    // Bygg panelist-payload (bara "new"-mappade)
    const newSpeakers = store.speakers.filter((s) => s.action === "new");
    const panelistsPayload = newSpeakers.map((s, i) => ({
      tempId: s.tempId,
      name: s.detectedName,
      color: s.color || PANELIST_PALETTE[i % PANELIST_PALETTE.length],
    }));

    // För "existing"-mappningar: byt ut tempId mot riktigt id direkt i HTML
    let cards = store.cards;
    const existingMappings = store.speakers.filter((s) => s.action === "existing" && s.existingPanelistId);
    const ignoreMappings = store.speakers.filter((s) => s.action === "ignore");

    if (existingMappings.length > 0 || ignoreMappings.length > 0) {
      cards = cards.map((c) => {
        let html = c.contentHtml;
        for (const m of existingMappings) {
          html = html.split(`data-panelist-id="${m.tempId}"`).join(`data-panelist-id="${m.existingPanelistId}"`);
        }
        for (const m of ignoreMappings) {
          // Ta bort attribut för ignorerade — span:en blir kvar utan styling
          html = html.replace(
            new RegExp(`data-panelist-id="${escapeRegex(m.tempId)}"`, "g"),
            ""
          );
          html = html.replace(
            new RegExp(`data-panelist-name="${escapeRegex(m.detectedName)}"`, "g"),
            ""
          );
        }
        return { ...c, contentHtml: html };
      });
    }

    const cardsPayload = cards.map((c, i) => ({
      position: i,
      role: "speaker",
      title: c.title,
      content_html: c.contentHtml,
    }));

    const manuscriptPayload = {
      title: store.title.trim() || "Importerat manus",
      mode: "speaker",
      text_size: store.textSize,
      target_duration_seconds: store.targetSeconds || null,
      wpm: 140,
      tags: [],
    };

    const { data, error } = await supabase.rpc("import_manuscript" as never, {
      p_manuscript: manuscriptPayload,
      p_panelists: panelistsPayload,
      p_cards: cardsPayload,
    } as never);

    setCommitting(false);

    if (error) {
      toast({
        title: "Importen misslyckades",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const newId = data as unknown as string;
    toast({
      title: "Manus importerat",
      description: `${cards.length} kort skapade`,
    });
    store.reset();
    navigate(`/manus/${newId}`);
  };

  const cancel = () => {
    if (store.dirty && !confirm("Avbryta importen? Dina val går förlorade.")) return;
    store.reset();
    navigate("/");
  };

  // ============== GATING: PRO-only ==============
  if (importBlocked) {
    return (
      <div className="min-h-screen">
        <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="rounded-full">
            <ArrowLeft className="h-4 w-4" /> Tillbaka
          </Button>
          <h1 className="font-display text-[17px] font-semibold tracking-tight">Importera manus</h1>
        </header>
        <main className="max-w-[560px] mx-auto px-6 sm:px-10 pt-24 pb-20 text-center flex flex-col gap-6 items-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Import är en PRO-funktion
            </h2>
            <p className="text-[15px] text-muted-foreground">
              .docx-import ingår inte i Gratis. Uppgradera till PRO för att importera dokument och spara timmar av manuell skrivning.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/">Tillbaka</Link>
            </Button>
            <Button asChild className="rounded-full bg-accent-blue text-white hover:bg-accent-blue/90">
              <Link to="/priser">Se PRO</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============== STEG 1 ==============
  if (step === 1) {
    return (
      <div className="min-h-screen">
        <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="rounded-full">
            <ArrowLeft className="h-4 w-4" /> Tillbaka
          </Button>
          <h1 className="font-display text-[17px] font-semibold tracking-tight">
            Importera manus
          </h1>
        </header>

        <main className="max-w-[720px] mx-auto px-6 sm:px-10 pt-12 pb-20">
          <div className="mb-8">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
              Ladda upp ett dokument
            </h2>
            <p className="text-muted-foreground text-[15px] mt-2">
              Vi delar in det åt dig och du justerar i nästa steg.
            </p>
          </div>

          <div className="space-y-8">
            <UploadZone
              file={store.file}
              onFileSelected={handleFileSelected}
              onClear={() => {
                store.setFile(null);
                store.setRawBlocks([]);
              }}
              disabled={parsing}
            />

            {parsing && (
              <div className="flex items-center gap-2 text-muted-foreground text-[14px]">
                <Loader2 className="h-4 w-4 animate-spin" /> Läser dokumentet…
              </div>
            )}

            {store.file && !parsing && store.rawBlocks.length > 0 && (
              <SettingsForm hasHeadings={hasHeadings} />
            )}
          </div>

          <div className="flex justify-end gap-3 mt-10">
            <Button variant="ghost" onClick={cancel} className="rounded-full">
              Avbryt
            </Button>
            <Button
              onClick={goToPreview}
              disabled={!store.file || parsing || store.rawBlocks.length === 0}
              className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white"
            >
              Fortsätt till förhandsvisning
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============== STEG 2 ==============
  const totalWords = store.cards.reduce((sum, c) => sum + c.wordCount, 0);
  const estTotalSec = estimateSeconds(totalWords, 140);
  const targetDiff = estTotalSec - store.targetSeconds;
  const hasOverflowCards = store.cards.some((c) => exceedsThreshold(c, store.textSize));

  return (
    <div className="min-h-screen">
      <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="rounded-full">
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Button>
        <input
          value={store.title}
          onChange={(e) => store.setTitle(e.target.value)}
          className="bg-transparent font-display text-[17px] font-semibold tracking-tight outline-none flex-1 min-w-0"
        />
        <div className="seg-group">
          {(["headings", "wordcount", "paragraph"] as const).map((s) => {
            const enabled = s === "headings" ? hasHeadings : true;
            return (
              <button
                key={s}
                disabled={!enabled}
                onClick={() => {
                  store.setStrategy(s);
                  setTimeout(rebuildCards, 0);
                }}
                data-active={store.strategy === s}
                className="seg-btn disabled:opacity-40"
              >
                {s === "headings" ? "Rubriker" : s === "wordcount" ? "Ordantal" : "Stycke"}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={cancel} className="rounded-full">
          Avbryt
        </Button>
        <Button
          onClick={commit}
          disabled={committing || store.cards.length === 0}
          className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white"
        >
          {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Skapa manus
        </Button>
      </header>

      <main className="max-w-[900px] mx-auto px-6 sm:px-10 pt-8 pb-20 space-y-5">
        <SpeakerMappingPanel existing={[]} />

        {(store.skipped.images > 0 ||
          store.skipped.tables > 0 ||
          store.skipped.footnotes > 0) && (
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-muted-foreground">
            Från ditt dokument kunde inte importeras:{" "}
            {[
              store.skipped.images && `${store.skipped.images} bilder`,
              store.skipped.tables && `${store.skipped.tables} tabeller`,
              store.skipped.footnotes && `${store.skipped.footnotes} fotnoter`,
            ]
              .filter(Boolean)
              .join(", ")}
            . Lägg till dessa manuellt i redigeringsläget om du behöver dem.
          </div>
        )}

        <div className="space-y-3">
          {store.cards.map((c, i) => (
            <PreviewCardItem
              key={c.id}
              card={c}
              index={i}
              total={store.cards.length}
              textSize={store.textSize}
              onRename={(t) => updateCard(i, { title: t })}
              onMergePrev={() => mergeWith(i, i - 1)}
              onMergeNext={() => mergeWith(i, i + 1)}
              onRemove={() => removeCard(i)}
              onMoveUp={() => move(i, -1)}
              onMoveDown={() => move(i, 1)}
              onSplitAt={(p) => splitAt(i, p)}
            />
          ))}
        </div>

        <div className="rounded-2xl bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[13px] text-muted-foreground">Totalt</p>
              <p className="font-display text-[17px] font-semibold">
                {store.cards.length} kort · {totalWords} ord · {formatDuration(estTotalSec)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-muted-foreground">Måltid</p>
              <p className="font-display text-[17px] font-semibold">
                {formatDuration(store.targetSeconds)}
                {Math.abs(targetDiff) > 60 && (
                  <span
                    className={`text-[13px] font-normal ml-2 ${
                      targetDiff > 0 ? "text-[hsl(var(--cue-amber))]" : "text-muted-foreground"
                    }`}
                  >
                    ({targetDiff > 0 ? "+" : ""}
                    {formatDuration(Math.abs(targetDiff))})
                  </span>
                )}
              </p>
            </div>
          </div>
          {hasOverflowCards && (
            <p className="text-[12px] text-[hsl(var(--cue-amber))] mt-2">
              Vissa kort kan vara för långa för vald textstorlek — du kan splitta dem ovan.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
