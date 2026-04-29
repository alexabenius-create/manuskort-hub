import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { LIMITS } from "@/lib/tierLimits";
import { useImportStore } from "@/lib/import/importStore";
import { SEO } from "@/components/SEO";
import { HelpButton } from "@/components/HelpButton";
import { UploadZone } from "@/components/import/UploadZone";
import { SettingsForm } from "@/components/import/SettingsForm";
import { PreviewCardItem } from "@/components/import/PreviewCardItem";
import { CardGutter } from "@/components/import/CardGutter";
import { SpeakerMappingPanel } from "@/components/import/SpeakerMappingPanel";
import { ModeSelector } from "@/components/import/ModeSelector";
import { SkippedContentPanel } from "@/components/import/SkippedContentPanel";
import { detectFileKind, parseFile } from "@/lib/import/parseDocument";
import { autoDetectStrategy, buildCards, detectedSpeakerNames } from "@/lib/import/buildCards";
import { WORDS_PER_CARD_DEFAULT, exceedsThreshold } from "@/lib/import/splitStrategies";
import type { PreviewCard } from "@/lib/import/splitStrategies";
import { PANELIST_PALETTE } from "@/lib/panelistColors";
import { recolorQuestionsInHtml, stripQuestionsForTempIds } from "@/lib/import/detectQuestions";
import { wordCount, estimateSeconds, formatDuration, stripHtml } from "@/lib/wordCount";

/**
 * ImportV2 — samma logik som Import.tsx men med Landing v2-designspråk.
 * Shell + ramverk uppdaterat: mesh-glow bakgrund, glas-topbar, gradient-CTA.
 * Inre import-komponenter (UploadZone, SettingsForm, PreviewCardItem etc.) återanvänds som de är.
 */
export default function ImportV2() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const limits = LIMITS[tier];
  const store = useImportStore();
  const [step, setStep] = useState<0 | 1 | 2>(store.mode ? 1 : 0);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  const importBlocked = !tierLoading && !limits.docxImport;

  useEffect(() => {
    const stateFile = (location.state as { file?: File } | null)?.file;
    if (stateFile && !store.file) {
      handleFileSelected(stateFile);
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== 2 || !store.dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, store.dirty]);

  useEffect(() => {
    if (step !== 2 || store.cards.length === 0) return;
    const colorMap = new Map<string, string>();
    const ignoredIds = new Set<string>();
    for (const s of store.speakers) {
      if (s.action === "ignore") {
        ignoredIds.add(s.tempId);
        if (s.existingPanelistId) ignoredIds.add(s.existingPanelistId);
        continue;
      }
      if (s.color) colorMap.set(s.tempId, s.color);
      if (s.action === "existing" && s.existingPanelistId && s.color) {
        colorMap.set(s.existingPanelistId, s.color);
      }
    }
    if (colorMap.size === 0 && ignoredIds.size === 0) return;
    let anyChanged = false;
    const next = store.cards.map((c) => {
      let html = c.contentHtml;
      if (ignoredIds.size > 0) html = stripQuestionsForTempIds(html, ignoredIds);
      if (colorMap.size > 0) html = recolorQuestionsInHtml(html, colorMap);
      if (html === c.contentHtml) return c;
      anyChanged = true;
      return { ...c, contentHtml: html };
    });
    if (anyChanged) store.setCards(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.speakers, step]);

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
      store.setSkippedItems(result.skippedItems);
      const filename = file.name.replace(/\.(docx|txt)$/i, "");
      store.setTitle(result.title || filename);
      const auto = autoDetectStrategy(result.blocks);
      store.setStrategy(auto);
      store.setWordsPerCard(WORDS_PER_CARD_DEFAULT[store.textSize]);
    } catch (e) {
      toast({
        title: t("import.toast_file_failed_title"),
        description: e instanceof Error ? e.message : t("import.toast_file_failed_desc"),
        variant: "destructive",
      });
      store.setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const hasHeadings = useMemo(
    () => store.rawBlocks.some((b) => b.type === "heading" && (b.level === 1 || b.level === 2)),
    [store.rawBlocks]
  );

  const goToPreview = () => {
    if (!store.file || store.rawBlocks.length === 0) {
      toast({ title: t("import.toast_upload_first"), variant: "destructive" });
      return;
    }
    if (!store.title.trim()) {
      toast({ title: t("import.toast_title_required"), variant: "destructive" });
      return;
    }

    const tempIds = new Map<string, string>();
    const detectedNamesPre = detectedSpeakerNames(store.rawBlocks, store.mode ?? "speaker");
    const speakerColors = new Map<string, string>();
    detectedNamesPre.forEach((name, i) => {
      speakerColors.set(name, PANELIST_PALETTE[i % PANELIST_PALETTE.length]);
    });

    const cards = buildCards({
      blocks: store.rawBlocks,
      strategy: store.strategy,
      wordsPerCard: store.wordsPerCard,
      textSize: store.textSize,
      speakerTempIds: tempIds,
      mode: store.mode ?? "speaker",
      speakerColors,
    });

    const speakerMappings = detectedNamesPre.map((name, i) => ({
      detectedName: name,
      tempId: tempIds.get(name) || `tmp:${name}`,
      action: "new" as const,
      color: speakerColors.get(name) || PANELIST_PALETTE[i % PANELIST_PALETTE.length],
    }));

    store.speakerTempIds.clear();
    tempIds.forEach((v, k) => store.speakerTempIds.set(k, v));
    store.setCards(cards);
    store.setSpeakers(speakerMappings);
    setStep(2);
  };

  const rebuildCards = () => {
    if (store.dirty) {
      if (!confirm(t("import.rebuild_confirm"))) return;
    }
    const tempIds = new Map<string, string>();
    const speakerColors = new Map<string, string>();
    for (const s of store.speakers) {
      if (s.color) speakerColors.set(s.detectedName, s.color);
    }
    const cards = buildCards({
      blocks: store.rawBlocks,
      strategy: store.strategy,
      wordsPerCard: store.wordsPerCard,
      textSize: store.textSize,
      speakerTempIds: tempIds,
      mode: store.mode ?? "speaker",
      speakerColors,
    });
    store.setCards(cards);
    useImportStore.setState({ dirty: false });
  };

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
    const titleFromText = (h: string) => stripHtml(h).split(/[.!?…]/)[0].slice(0, 60).trim() || t("import.default_card_title");
    const a: PreviewCard = { ...c, contentHtml: firstHtml, paragraphsHtml: firstParas, wordCount: wordCount(firstHtml) };
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

  const insertEmptyAt = (idx: number) => {
    const empty: PreviewCard = {
      id: `pc_empty_${Date.now().toString(36)}`,
      title: t("import.new_empty_card"),
      contentHtml: "<p></p>",
      paragraphsHtml: ["<p></p>"],
      wordCount: 0,
    };
    const next = [...store.cards];
    next.splice(idx, 0, empty);
    store.setCards(next);
    store.markDirty();
  };

  const moveTo = (sourceIdx: number, targetIdx: number) => {
    if (sourceIdx === targetIdx) return;
    const next = [...store.cards];
    const [moved] = next.splice(sourceIdx, 1);
    const insertAt = sourceIdx < targetIdx ? targetIdx - 1 : targetIdx;
    next.splice(insertAt, 0, moved);
    store.setCards(next);
    store.markDirty();
  };

  const commit = async () => {
    if (!user) return;
    setCommitting(true);
    const newSpeakers = store.speakers.filter((s) => s.action === "new");
    const panelistsPayload = newSpeakers.map((s, i) => ({
      tempId: s.tempId,
      name: s.detectedName,
      color: s.color || PANELIST_PALETTE[i % PANELIST_PALETTE.length],
    }));

    let cards = store.cards;
    const existingMappings = store.speakers.filter((s) => s.action === "existing" && s.existingPanelistId);
    const ignoreMappings = store.speakers.filter((s) => s.action === "ignore");

    if (existingMappings.length > 0 || ignoreMappings.length > 0) {
      const ignoredIds = new Set<string>();
      for (const m of ignoreMappings) {
        ignoredIds.add(m.tempId);
        if (m.existingPanelistId) ignoredIds.add(m.existingPanelistId);
      }
      cards = cards.map((c) => {
        let html = c.contentHtml;
        if (ignoredIds.size > 0) html = stripQuestionsForTempIds(html, ignoredIds);
        for (const m of existingMappings) {
          html = html.split(`data-panelist-id="${m.tempId}"`).join(`data-panelist-id="${m.existingPanelistId}"`);
        }
        for (const m of ignoreMappings) {
          html = html.replace(new RegExp(`data-panelist-id="${escapeRegex(m.tempId)}"`, "g"), "");
          html = html.replace(new RegExp(`data-panelist-name="${escapeRegex(m.detectedName)}"`, "g"), "");
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
      title: store.title.trim() || t("import.default_title"),
      mode: store.mode ?? "speaker",
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
      toast({ title: t("import.toast_import_failed"), description: error.message, variant: "destructive" });
      return;
    }

    const newId = data as unknown as string;
    toast({ title: t("import.toast_imported_title"), description: t("import.toast_imported_desc", { count: cards.length }) });
    store.reset();
    navigate(`/manus/${newId}/v4`);
  };

  const cancel = () => {
    if (store.dirty && !confirm(t("import.cancel_confirm"))) return;
    store.reset();
    navigate("/bibliotek-v2");
  };

  // V2 mesh-glow bakgrund
  const MeshBg = () => (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
           style={{ background: "radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)" }} />
      <div className="absolute top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-40 blur-3xl"
           style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-1/3 h-[460px] w-[460px] rounded-full opacity-30 blur-3xl"
           style={{ background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 70%)" }} />
    </div>
  );

  const Topbar = ({ left, title, right }: { left: React.ReactNode; title: React.ReactNode; right?: React.ReactNode }) => (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-v2-line px-6 sm:px-10 h-14 flex items-center gap-4">
      {left}
      {typeof title === "string" ? (
        <h1 className="font-display text-[17px] font-semibold tracking-tight text-v2-ink">{title}</h1>
      ) : title}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );

  // ============== GATING: PRO-only ==============
  if (importBlocked) {
    return (
      <div className="bg-v2-bg min-h-screen relative overflow-hidden text-v2-ink">
        <SEO title={t("import.page_title")} noindex nofollow />
        <MeshBg />
        <Topbar
          left={
            <Button variant="ghost" size="sm" onClick={() => navigate("/bibliotek-v2")} className="rounded-full text-v2-muted hover:text-v2-ink hover:bg-white h-8 -ml-2">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("import.back")}
            </Button>
          }
          title={t("import.header_title")}
        />
        <main className="relative max-w-[560px] mx-auto px-6 sm:px-10 pt-24 pb-20 text-center flex flex-col gap-6 items-center v2-reveal">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)]"
               style={{ backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" }}>
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">
              {t("import.pro_gate_title")}
            </h2>
            <p className="text-[15px] text-v2-muted">
              {t("import.pro_gate_desc")}
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/bibliotek-v2" className="inline-flex items-center justify-center h-11 px-5 rounded-full text-[14px] text-v2-muted hover:text-v2-ink hover:bg-white transition-colors">
              {t("import.back")}
            </Link>
            <Link to="/priser-v2" className="v2-btn-primary">
              <span className="relative z-10">{t("import.pro_gate_cta")}</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ============== STEG 0 — Mode-val ==============
  if (step === 0) {
    return (
      <div className="bg-v2-bg min-h-screen relative overflow-hidden text-v2-ink">
        <SEO title={t("import.page_title")} noindex nofollow />
        <MeshBg />
        <Topbar
          left={
            <Button variant="ghost" size="sm" onClick={() => navigate("/bibliotek-v2")} className="rounded-full text-v2-muted hover:text-v2-ink hover:bg-white h-8 -ml-2">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("import.back")}
            </Button>
          }
          title={t("import.header_title")}
          right={<HelpButton />}
        />
        <main className="relative max-w-[720px] mx-auto px-6 sm:px-10 pt-12 pb-20">
          <div className="mb-8 v2-reveal">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">
              {t("import.step0_heading")}
            </h2>
            <p className="text-v2-muted text-[15px] mt-2">
              {t("import.step0_desc")}
            </p>
          </div>

          <ModeSelector
            value={store.mode}
            onChange={(m) => { store.setMode(m); setStep(1); }}
          />

          <div className="flex justify-end gap-3 mt-10">
            <Button variant="ghost" onClick={cancel} className="rounded-full text-v2-muted hover:text-v2-ink">
              {t("import.cancel")}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============== STEG 1 ==============
  if (step === 1) {
    return (
      <div className="bg-v2-bg min-h-screen relative overflow-hidden text-v2-ink">
        <SEO title={t("import.page_title")} noindex nofollow />
        <MeshBg />
        <Topbar
          left={
            <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="rounded-full text-v2-muted hover:text-v2-ink hover:bg-white h-8 -ml-2">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("import.back_change_type")}
            </Button>
          }
          title={t("import.header_title_with_mode", { mode: store.mode === "moderator" ? t("import.mode_moderator") : t("import.mode_speaker") })}
          right={<HelpButton />}
        />

        <main className="relative max-w-[720px] mx-auto px-6 sm:px-10 pt-12 pb-20">
          <div className="mb-8 v2-reveal">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">
              {t("import.step1_heading")}
            </h2>
            <p className="text-v2-muted text-[15px] mt-2">
              {t("import.step1_desc")}
            </p>
          </div>

          <div className="space-y-8 bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm p-6 sm:p-8">
            <UploadZone
              file={store.file}
              onFileSelected={handleFileSelected}
              onClear={() => { store.setFile(null); store.setRawBlocks([]); }}
              disabled={parsing}
            />

            {parsing && (
              <div className="flex items-center gap-2 text-v2-muted text-[14px]">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("import.parsing")}
              </div>
            )}

            {store.file && !parsing && store.rawBlocks.length > 0 && (
              <SettingsForm hasHeadings={hasHeadings} />
            )}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <Button variant="ghost" onClick={cancel} className="rounded-full text-v2-muted hover:text-v2-ink">
              {t("import.cancel")}
            </Button>
            <button
              onClick={goToPreview}
              disabled={!store.file || parsing || store.rawBlocks.length === 0}
              className="v2-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10">{t("import.continue_to_preview")}</span>
            </button>
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
    <div className="bg-v2-bg min-h-screen relative overflow-hidden text-v2-ink">
      <SEO title={t("import.page_title")} noindex nofollow />
      <MeshBg />
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-v2-line px-6 sm:px-10 h-14 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="rounded-full text-v2-muted hover:text-v2-ink hover:bg-white h-8 -ml-2">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("import.back")}
        </Button>
        <input
          value={store.title}
          onChange={(e) => store.setTitle(e.target.value)}
          className="bg-transparent font-display text-[17px] font-semibold tracking-tight outline-none flex-1 min-w-0 text-v2-ink"
        />
        <div className="seg-group">
          {(["headings", "wordcount", "paragraph"] as const).map((s) => {
            const enabled = s === "headings" ? hasHeadings : true;
            return (
              <button
                key={s}
                disabled={!enabled}
                onClick={() => { store.setStrategy(s); setTimeout(rebuildCards, 0); }}
                data-active={store.strategy === s}
                className="seg-btn disabled:opacity-40"
              >
                {s === "headings" ? t("import.strategy_headings") : s === "wordcount" ? t("import.strategy_wordcount") : t("import.strategy_paragraph")}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={cancel} className="rounded-full text-v2-muted hover:text-v2-ink">
          {t("import.cancel")}
        </Button>
        <button
          onClick={commit}
          disabled={committing || store.cards.length === 0}
          className="v2-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="relative z-10 inline-flex items-center gap-1">
            {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("import.create_manuscript")}
          </span>
        </button>
        <HelpButton />
      </header>

      <main className="relative max-w-[900px] mx-auto px-6 sm:px-10 pt-8 pb-20 space-y-5">
        {store.mode === "moderator" && <SpeakerMappingPanel existing={[]} />}

        <SkippedContentPanel items={store.skippedItems} />

        <div className="space-y-0">
          {store.cards.map((c, i) => (
            <div key={c.id}>
              <CardGutter
                index={i}
                canMerge={i > 0}
                onMerge={() => mergeWith(i, i - 1)}
                onInsertEmpty={() => insertEmptyAt(i)}
                onDropCard={(src) => moveTo(src, i)}
              />
              <PreviewCardItem
                card={c}
                index={i}
                total={store.cards.length}
                textSize={store.textSize}
                speakers={store.speakers}
                isDragging={draggingIdx === i}
                isDropTarget={dropTargetIdx === i && draggingIdx !== null && draggingIdx !== i}
                onRename={(t) => updateCard(i, { title: t })}
                onContentChange={(html) => updateCard(i, { contentHtml: html, wordCount: wordCount(html) })}
                onMergePrev={() => mergeWith(i, i - 1)}
                onMergeNext={() => mergeWith(i, i + 1)}
                onRemove={() => removeCard(i)}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                onSplitAt={(p) => splitAt(i, p)}
                onDragStart={() => setDraggingIdx(i)}
                onDragEnd={() => { setDraggingIdx(null); setDropTargetIdx(null); }}
                onDropCard={(src) => {
                  if (src !== i) mergeWith(src, i);
                  setDropTargetIdx(null);
                }}
                onDragOverCard={(over) => setDropTargetIdx(over ? i : (dropTargetIdx === i ? null : dropTargetIdx))}
              />
            </div>
          ))}
          {store.cards.length > 0 && (
            <CardGutter
              index={store.cards.length}
              canMerge={false}
              onMerge={() => {}}
              onInsertEmpty={() => insertEmptyAt(store.cards.length)}
              onDropCard={(src) => moveTo(src, store.cards.length)}
            />
          )}
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-v2-line p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[13px] text-v2-muted">{t("import.totals_label")}</p>
              <p className="font-display text-[17px] font-semibold text-v2-ink">
                {t("import.totals_summary", { count: store.cards.length, words: totalWords, duration: formatDuration(estTotalSec) })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-v2-muted">{t("import.target_label")}</p>
              <p className="font-display text-[17px] font-semibold text-v2-ink">
                {formatDuration(store.targetSeconds)}
                {Math.abs(targetDiff) > 60 && (
                  <span className={`text-[13px] font-normal ml-2 ${targetDiff > 0 ? "text-[hsl(var(--cue-amber))]" : "text-v2-muted"}`}>
                    ({targetDiff > 0 ? "+" : ""}{formatDuration(Math.abs(targetDiff))})
                  </span>
                )}
              </p>
            </div>
          </div>
          {hasOverflowCards && (
            <p className="text-[12px] text-[hsl(var(--cue-amber))] mt-2">
              {t("import.overflow_warning")}
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
