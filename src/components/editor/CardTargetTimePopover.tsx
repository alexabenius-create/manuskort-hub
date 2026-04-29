/**
 * CardTargetTimePopover — chip i header som visar mål-tid eller "+ Sätt mål".
 */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Target, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  targetSeconds: number | null;
  isManual: boolean;
  estimatedSeconds: number;
  onSave: (next: { targetSeconds: number | null; isManual: boolean }) => void;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function CardTargetTimePopover({
  targetSeconds,
  isManual,
  estimatedSeconds,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const seed = isManual && targetSeconds != null ? targetSeconds : estimatedSeconds;
  const [min, setMin] = useState(Math.floor(seed / 60));
  const [sec, setSec] = useState(seed % 60);

  useEffect(() => {
    if (open) {
      const s = isManual && targetSeconds != null ? targetSeconds : estimatedSeconds;
      setMin(Math.floor(s / 60));
      setSec(s % 60);
    }
  }, [open, isManual, targetSeconds, estimatedSeconds]);

  const save = () => {
    const total = clamp(min, 0, 99) * 60 + clamp(sec, 0, 59);
    if (total <= 0) {
      onSave({ targetSeconds: null, isManual: false });
    } else {
      onSave({ targetSeconds: total, isManual: true });
    }
    setOpen(false);
  };
  const auto = () => {
    onSave({ targetSeconds: null, isManual: false });
    setOpen(false);
  };

  const showLabel = isManual && targetSeconds != null;
  const label = showLabel ? fmt(targetSeconds!) : t("editor.card.target_set");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          contentEditable={false}
          className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[11px] font-mono uppercase tracking-wider transition-colors ${
            showLabel
              ? "bg-accent-blue/10 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/15"
              : "bg-surface-2 text-muted-foreground border-dashed border-border/50 hover:text-foreground hover:border-border"
          }`}
          aria-label={showLabel
            ? t("editor.card.target_chip_aria_set", { label })
            : t("editor.card.target_chip_aria_unset")}
        >
          <Target className="h-3 w-3" />
          <span className="tabular-nums">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-60 p-3"
        contentEditable={false}
      >
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              {t("editor.card.target_label")}
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={99}
                value={min}
                onChange={(e) => setMin(clamp(parseInt(e.target.value) || 0, 0, 99))}
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="h-9 w-16 text-center tabular-nums"
                aria-label={t("editor.card.target_input_minutes_aria")}
              />
              <span className="text-muted-foreground font-mono">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={sec}
                onChange={(e) => setSec(clamp(parseInt(e.target.value) || 0, 0, 59))}
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="h-9 w-16 text-center tabular-nums"
                aria-label={t("editor.card.target_input_seconds_aria")}
              />
              <span className="text-[11px] text-muted-foreground ml-1">
                {t("editor.card.target_estimate_short", { time: fmt(estimatedSeconds) })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} className="flex-1">
              {t("editor.card.target_save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={auto}
              disabled={!isManual}
              className="gap-1"
              title={t("editor.card.target_auto_tip")}
            >
              <RotateCcw className="h-3 w-3" />
              {t("editor.card.target_auto")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
