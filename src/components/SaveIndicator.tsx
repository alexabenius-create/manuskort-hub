import { useSaveStatus } from "@/lib/saveStatus";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Kompakt = bara ikon + tooltip. Default: false (ikon + text). */
  compact?: boolean;
}

export function SaveIndicator({ compact = false }: Props) {
  const status = useSaveStatus();
  const { t } = useTranslation();

  if (compact) {
    const label =
      status === "saving" ? (t("save_indicator.saving") as string) :
      status === "error" ? (t("save_indicator.error") as string) :
      (t("save_indicator.saved") as string);
    const dot =
      status === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> :
      status === "error" ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> :
      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--cue-teal))]" aria-hidden />;
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            aria-live="polite"
            aria-label={label}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-2 transition-colors cursor-default"
          >
            {dot}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[12px] rounded-lg">{label}</TooltipContent>
      </Tooltip>
    );
  }

  if (status === "idle") return <span aria-live="polite" className="sr-only">{t("save_indicator.saved_aria")}</span>;
  return (
    <span
      aria-live="polite"
      className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5"
    >
      {status === "saving" && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("save_indicator.saving_short")}</>)}
      {status === "saved" && (<><Check className="h-3.5 w-3.5" /> {t("save_indicator.saved_short")}</>)}
      {status === "error" && (<><AlertCircle className="h-3.5 w-3.5 text-destructive" /> <span className="text-destructive">{t("save_indicator.error_short")}</span></>)}
    </span>
  );
}
