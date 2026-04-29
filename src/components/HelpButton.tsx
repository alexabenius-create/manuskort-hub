import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpSheet } from "./HelpSheet";

interface Props {
  className?: string;
}

export function HelpButton({ className }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("help.button_aria")}
            className={
              "inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors " +
              (className ?? "")
            }
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[12px]">
          {t("help.button_tooltip")}
        </TooltipContent>
      </Tooltip>

      <HelpSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
