import { Mic, MessageSquareReply } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: "speaker" | "replier" | null;
  onChange: (role: "speaker" | "replier") => void;
}

export function RoleSelector({ value, onChange }: Props) {
  return (
    <div className="rounded-2xl bg-white border border-v2-violet/30 p-5 space-y-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-violet">Steg 1 — Din roll i debatten</div>
        <p className="text-[13px] text-v2-ink mt-1">
          Välj din roll så vägleder verktyget dig genom rätt steg.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange("speaker")}
          className={cn(
            "text-left p-4 rounded-xl border-2 transition-all",
            value === "speaker"
              ? "border-v2-violet bg-v2-violet/5"
              : "border-v2-line bg-white hover:border-v2-violet/40",
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <Mic className="h-4 w-4 text-v2-violet" />
            <div className="font-semibold text-[14px] text-v2-ink">Jag håller anförandet</div>
          </div>
          <p className="text-[12px] text-v2-muted leading-relaxed">
            Du går först. Andra debattörer kan begära replik och du väljer om du vill bemöta dem med genmäle.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange("replier")}
          className={cn(
            "text-left p-4 rounded-xl border-2 transition-all",
            value === "replier"
              ? "border-v2-violet bg-v2-violet/5"
              : "border-v2-line bg-white hover:border-v2-violet/40",
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <MessageSquareReply className="h-4 w-4 text-v2-violet" />
            <div className="font-semibold text-[14px] text-v2-ink">Jag är replikant</div>
          </div>
          <p className="text-[12px] text-v2-muted leading-relaxed">
            Någon annan håller anförandet. Du skriver ner vad de sa och AI bygger din replik.
          </p>
        </button>
      </div>
    </div>
  );
}
