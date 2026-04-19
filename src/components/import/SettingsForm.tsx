import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { useImportStore } from "@/lib/import/importStore";
import { WORDS_PER_CARD_DEFAULT } from "@/lib/import/splitStrategies";
import type { SplitStrategy, TextSize } from "@/lib/import/splitStrategies";

const STRATEGY_HELP: Record<SplitStrategy, { title: string; body: string; best: string }> = {
  headings: {
    title: "Rubriker",
    body: "Varje rubrik i dokumentet startar ett nytt kort. Allt under rubriken hamnar på samma kort tills nästa rubrik kommer.",
    best: "Bäst för strukturerade manus med tydliga sektioner (t.ex. Inledning, Problem, Lösning).",
  },
  wordcount: {
    title: "Ordantal",
    body: "Bygger kort tills de når ett valt antal ord och stänger sedan på närmsta stycke-gräns. Du kan justera målantalet.",
    best: "Bäst för löpande prosa utan rubriker — föreläsningar, tal, brödtext.",
  },
  paragraph: {
    title: "En per stycke",
    body: "Varje stycke i dokumentet blir ett eget kort. Mycket korta stycken (<15 ord) slås ihop med föregående.",
    best: "Bäst för punchy talmanus där varje stycke är en enhet (one-liners, panelinlägg, korta cues).",
  },
};

interface Props {
  hasHeadings: boolean;
}

export function SettingsForm({ hasHeadings }: Props) {
  const {
    title,
    setTitle,
    targetSeconds,
    setTargetSeconds,
    textSize,
    setTextSize,
    strategy,
    setStrategy,
    wordsPerCard,
    setWordsPerCard,
  } = useImportStore();

  const presets: [number, string][] = [
    [3 * 60, "3 min"],
    [5 * 60, "5 min"],
    [10 * 60, "10 min"],
    [15 * 60, "15 min"],
    [20 * 60, "20 min"],
  ];

  const sizes: [TextSize, string][] = [
    ["sm", "Liten"],
    ["md", "Normal"],
    ["lg", "Stor"],
  ];

  const strategies: [SplitStrategy, string, boolean][] = [
    ["headings", "Rubriker", hasHeadings],
    ["wordcount", "Ordantal", true],
    ["paragraph", "En per stycke", true],
  ];

  const formatMmSs = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const parseMmSs = (raw: string): number | null => {
    const m = raw.match(/^(\d{1,3}):(\d{1,2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground font-medium">Titel</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Manus-titel"
          className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground font-medium">Måltid</Label>
        <div className="flex flex-wrap gap-2">
          {presets.map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => setTargetSeconds(s)}
              data-active={targetSeconds === s}
              className="seg-btn"
            >
              {label}
            </button>
          ))}
          <Input
            value={formatMmSs(targetSeconds)}
            onChange={(e) => {
              const v = parseMmSs(e.target.value);
              if (v !== null) setTargetSeconds(v);
            }}
            placeholder="mm:ss"
            className="w-24 h-9 rounded-full bg-surface-2 border-0 text-[13px] text-center"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground font-medium">Textstorlek</Label>
        <div className="seg-group">
          {sizes.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setTextSize(v);
                // Sync default words per card med ny storlek om strategi = wordcount
                setWordsPerCard(WORDS_PER_CARD_DEFAULT[v]);
              }}
              data-active={textSize === v}
              className="seg-btn"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-[13px] text-muted-foreground font-medium">
            Hur ska manuset delas?
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Förklaring av uppdelningsstrategier"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-80 text-[13px] space-y-3">
              <p className="text-muted-foreground">
                Välj hur ditt dokument ska delas upp i kort. Talar-byte (t.ex.{" "}
                <span className="font-medium text-foreground">Anna:</span> →{" "}
                <span className="font-medium text-foreground">Bengt:</span>) startar alltid ett nytt
                kort, oavsett val.
              </p>
              <div className="rounded-md bg-muted/50 p-2.5 space-y-1">
                <div className="font-semibold text-foreground">Vad är en rubrik?</div>
                <p className="text-muted-foreground leading-snug">
                  En text som du i Word eller Google Docs har formaterat som{" "}
                  <span className="font-medium text-foreground">Rubrik 1</span> eller{" "}
                  <span className="font-medium text-foreground">Rubrik 2</span> (Format → Stilar).
                  Det räcker inte att bara göra texten större och fet.
                </p>
              </div>
              {strategies.map(([v]) => {
                const h = STRATEGY_HELP[v];
                return (
                  <div key={v} className="space-y-1">
                    <div className="font-semibold text-foreground">{h.title}</div>
                    <p className="text-muted-foreground leading-snug">{h.body}</p>
                    <p className="text-muted-foreground leading-snug italic">{h.best}</p>
                  </div>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
        <div className="seg-group">
          {strategies.map(([v, label, enabled]) => (
            <button
              key={v}
              type="button"
              disabled={!enabled}
              onClick={() => setStrategy(v)}
              data-active={strategy === v}
              className="seg-btn disabled:opacity-40"
              title={!enabled ? "Dokumentet saknar rubriker" : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        {STRATEGY_HELP[strategy] && (
          <p className="text-[12px] text-muted-foreground leading-snug pt-1">
            <span className="font-medium text-foreground">{STRATEGY_HELP[strategy].title}:</span>{" "}
            {STRATEGY_HELP[strategy].body}
          </p>
        )}
      </div>

      {strategy === "wordcount" && (
        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground font-medium">
            Ordantal per kort
          </Label>
          <Input
            type="number"
            min={20}
            max={500}
            value={wordsPerCard}
            onChange={(e) => setWordsPerCard(parseInt(e.target.value, 10) || 0)}
            className="w-32 h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
          />
          <p className="text-[12px] text-muted-foreground">
            Förslag för {textSize === "sm" ? "liten" : textSize === "md" ? "normal" : "stor"} text:{" "}
            {WORDS_PER_CARD_DEFAULT[textSize]} ord
          </p>
        </div>
      )}
    </div>
  );
}
