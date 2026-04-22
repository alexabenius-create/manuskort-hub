import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackDialog } from "./FeedbackDialog";

interface Props {
  source: "landing" | "library" | "editor";
  manuscriptId?: string | null;
  className?: string;
  /** Visa text ("Feedback") bredvid ikonen — annars bara ikon. */
  withLabel?: boolean;
}

export function FeedbackButton({ source, manuscriptId, className, withLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Skicka feedback"
            className={
              "inline-flex items-center justify-center gap-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors " +
              (withLabel ? "h-8 px-3 text-[13px]" : "h-8 w-8") + " " +
              (className ?? "")
            }
          >
            <MessageSquare className="h-4 w-4" />
            {withLabel && <span>Feedback</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[12px]">
          Skicka feedback till oss
        </TooltipContent>
      </Tooltip>

      <FeedbackDialog open={open} onOpenChange={setOpen} source={source} manuscriptId={manuscriptId} />
    </>
  );
}
