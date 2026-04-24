import { Mic, MessageSquareReply } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: "speaker" | "replier" | null;
  onChange: (role: "speaker" | "replier") => void;
}

export function RoleSelectorDialog({ open, onOpenChange, value, onChange }: Props) {
  const handlePick = (role: "speaker" | "replier") => {
    onChange(role);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Steg 1 — Din roll i debatten</DialogTitle>
          <DialogDescription className="text-[13px]">
            Välj din roll så vägleder verktyget dig genom rätt steg.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => handlePick("speaker")}
            className={cn(
              "text-left p-4 rounded-xl border-2 transition-all hover:shadow-sm",
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
            onClick={() => handlePick("replier")}
            className={cn(
              "text-left p-4 rounded-xl border-2 transition-all hover:shadow-sm",
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
      </DialogContent>
    </Dialog>
  );
}
