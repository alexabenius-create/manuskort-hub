import { Trans, useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { useImportStore } from "@/lib/import/importStore";
import { WORDS_PER_CARD_DEFAULT } from "@/lib/import/splitStrategies";
import type { SplitStrategy, TextSize } from "@/lib/import/splitStrategies";

interface Props {
  hasHeadings: boolean;
}

export function SettingsForm({ hasHeadings }: Props) {
  const { t } = useTranslation();
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

  const STRATEGY_HELP: Record<SplitStrategy, { title: string; body: string; best: string }> = {
    headings: {
      title: t("import.settings.headings_title"),
      body: t("import.settings.headings_body"),
      best: t("import.settings.headings_best"),
    },
    wordcount: {
      title: t("import.settings.wordcount_title"),
      body: t("import.settings.wordcount_body"),
      best: t("import.settings.wordcount_best"),
    },
    paragraph: {
      title: t("import.settings.paragraph_title"),
      body: t("import.settings.paragraph_body"),
      best: t("import.settings.paragraph_best"),
    },
  };

  const presets: [number, string][] = [
    [3 * 60, t("import.settings.preset_3min")],
    [5 * 60, t("import.settings.preset_5min")],
    [10 * 60, t("import.settings.preset_10min")],
    [15 * 60, t("import.settings.preset_15min")],
    [20 * 60, t("import.settings.preset_20min")],
  ];

  const sizes: [TextSize, string][] = [
    ["sm", t("import.settings.size_sm")],
    ["md", t("import.settings.size_md")],
    ["lg", t("import.settings.size_lg")],
  ];

  const strategies: [SplitStrategy, string, boolean][] = [
    ["headings", STRATEGY_HELP.headings.title, hasHeadings],
    ["wordcount", STRATEGY_HELP.wordcount.title, true],
    ["paragraph", STRATEGY_HELP.paragraph.title, true],
  ];

  const hours = Math.floor(targetSeconds / 3600);
  const minutes = Math.floor((targetSeconds % 3600) / 60);
  const seconds = targetSeconds % 60;

  const updateParts = (h: number, m: number, s: number) => {
    setTargetSeconds(h * 3600 + m * 60 + s);
  };

  const formatTotal = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${m}:${pad(sec)}`;
  };

  const sizeLower = textSize === "sm"
    ? t("import.settings.size_sm_lower")
    : textSize === "md"
      ? t("import.settings.size_md_lower")
      : t("import.settings.size_lg_lower");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground font-medium">{t("import.settings.title_label")}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("import.settings.title_placeholder")}
          className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-[13px] text-muted-foreground font-medium">{t("import.settings.target_label")}</Label>
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
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <Label className="text-[12px] text-muted-foreground w-20 shrink-0">{t("import.settings.hours")}</Label>
            <Slider
              min={0}
              max={8}
              step={1}
              value={[hours]}
              onValueChange={([h]) => updateParts(h, minutes, seconds)}
              className="flex-1"
            />
            <span className="text-[12px] text-foreground font-medium w-14 text-right tabular-nums">{hours} {t("import.settings.hours_short")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-[12px] text-muted-foreground w-20 shrink-0">{t("import.settings.minutes")}</Label>
            <Slider
              min={0}
              max={59}
              step={1}
              value={[minutes]}
              onValueChange={([m]) => updateParts(hours, m, seconds)}
              className="flex-1"
            />
            <span className="text-[12px] text-foreground font-medium w-14 text-right tabular-nums">{minutes} {t("import.settings.minutes_short")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-[12px] text-muted-foreground w-20 shrink-0">{t("import.settings.seconds")}</Label>
            <Slider
              min={0}
              max={55}
              step={5}
              value={[seconds - (seconds % 5)]}
              onValueChange={([s]) => updateParts(hours, minutes, s)}
              className="flex-1"
            />
            <span className="text-[12px] text-foreground font-medium w-14 text-right tabular-nums">{seconds} {t("import.settings.seconds_short")}</span>
          </div>
          <div className="text-[12px] text-muted-foreground pt-1">
            {t("import.settings.total")}: <span className="font-medium text-foreground tabular-nums">{formatTotal(targetSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground font-medium">{t("import.settings.text_size_label")}</Label>
        <div className="seg-group">
          {sizes.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setTextSize(v);
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
            {t("import.settings.split_label")}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("import.settings.split_help_aria")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-80 text-[13px] space-y-3">
              <p className="text-muted-foreground">
                <Trans
                  i18nKey="import.settings.split_help_intro"
                  components={[
                    <span key="0" className="font-medium text-foreground" />,
                    <span key="1" className="font-medium text-foreground" />,
                  ]}
                />
              </p>
              <div className="rounded-md bg-muted/50 p-2.5 space-y-1">
                <div className="font-semibold text-foreground">{t("import.settings.heading_what")}</div>
                <p className="text-muted-foreground leading-snug">
                  <Trans
                    i18nKey="import.settings.heading_explain"
                    components={[
                      <span key="0" className="font-medium text-foreground" />,
                      <span key="1" className="font-medium text-foreground" />,
                    ]}
                  />
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
              title={!enabled ? t("import.settings.no_headings_tooltip") : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        {STRATEGY_HELP[strategy] && (
          <div className="text-[12px] text-muted-foreground leading-snug pt-1 space-y-1">
            <p>
              <span className="font-medium text-foreground">{STRATEGY_HELP[strategy].title}:</span>{" "}
              {STRATEGY_HELP[strategy].body}
            </p>
            <p>
              <span className="font-medium text-foreground">{t("import.settings.best_for")}</span>{" "}
              {STRATEGY_HELP[strategy].best.replace(/^(Bäst för|Best for)\s*/i, "")}
            </p>
          </div>
        )}
      </div>

      {strategy === "wordcount" && (
        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground font-medium">
            {t("import.settings.wordcount_per_card")}
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
            {t("import.settings.wordcount_suggestion", { size: sizeLower, count: WORDS_PER_CARD_DEFAULT[textSize] })}
          </p>
        </div>
      )}
    </div>
  );
}
