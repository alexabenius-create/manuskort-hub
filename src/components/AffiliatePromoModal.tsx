import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAffiliate } from "@/hooks/useAffiliate";
import { Copy, Check, Gift } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "affiliate_promo_last_seen";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function AffiliatePromoModal() {
  const { link, loading } = useAffiliate();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading || !link) return;
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      const lastTs = last ? parseInt(last, 10) : 0;
      if (!lastTs || Date.now() - lastTs > SEVEN_DAYS_MS) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    } catch { /* ignore */ }
  }, [loading, link]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Länk kopierad");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Kunde inte kopiera");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[440px] p-0 overflow-hidden">
        <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue mb-4">
            <Gift className="h-6 w-6" />
          </div>

          <DialogHeader className="space-y-3">
            <DialogTitle className="font-display text-[22px] leading-tight tracking-tight text-center">
              Bjud in andra — få kostnadsfri PRO
            </DialogTitle>
          </DialogHeader>

          <p className="text-[14px] text-muted-foreground leading-relaxed mt-3">
            Dela din affiliate-länk. När någon köper PRO via din länk får du:
          </p>
          <ul className="text-[14px] text-muted-foreground leading-relaxed mt-1 space-y-0.5">
            <li><strong className="text-foreground">1 månad</strong> kostnadsfri PRO per månadsprenumerant</li>
            <li><strong className="text-foreground">3 månader</strong> kostnadsfri PRO per årsprenumerant</li>
          </ul>

          <div className="flex items-center gap-2 w-full mt-6">
            <div className="flex-1 h-11 rounded-xl bg-surface-2 px-3 flex items-center text-[13px] font-mono truncate min-w-0">
              <span className="truncate">{link}</span>
            </div>
            <Button
              type="button"
              onClick={onCopy}
              className="h-11 rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5 shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Kopierad" : "Kopiera"}
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="rounded-full text-[13px] text-muted-foreground mt-4"
          >
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
