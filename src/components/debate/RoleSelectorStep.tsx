import { Mic, MessageSquareReply } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: "speaker" | "replier" | null;
  onPick: (role: "speaker" | "replier") => void;
}

/**
 * Inline (non-modal) version of the role selector — rendered as a full guided step.
 */
export function RoleSelectorStep({ value, onPick }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        type="button"
        onClick={() => onPick("speaker")}
        className={cn(
          "text-left p-6 rounded-2xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5",
          value === "speaker"
            ? "border-v2-violet bg-v2-violet/5 shadow-sm"
            : "border-v2-line bg-white hover:border-v2-violet/40",
        )}
      >
        <div className="h-10 w-10 rounded-full bg-v2-violet/10 text-v2-violet flex items-center justify-center mb-3">
          <Mic className="h-5 w-5" />
        </div>
        <div className="font-display text-[17px] font-semibold text-v2-ink mb-1.5">
          Jag håller anförandet
        </div>
        <p className="text-[13px] text-v2-muted leading-relaxed">
          Du går först. Andra debattörer kan begära replik och du väljer om du vill bemöta dem
          med genmäle.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onPick("replier")}
        className={cn(
          "text-left p-6 rounded-2xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5",
          value === "replier"
            ? "border-v2-violet bg-v2-violet/5 shadow-sm"
            : "border-v2-line bg-white hover:border-v2-violet/40",
        )}
      >
        <div className="h-10 w-10 rounded-full bg-v2-violet/10 text-v2-violet flex items-center justify-center mb-3">
          <MessageSquareReply className="h-5 w-5" />
        </div>
        <div className="font-display text-[17px] font-semibold text-v2-ink mb-1.5">
          Jag är replikant
        </div>
        <p className="text-[13px] text-v2-muted leading-relaxed">
          Någon annan håller anförandet. Du skriver ner vad de sa och AI bygger din replik.
        </p>
      </button>
    </div>
  );
}
