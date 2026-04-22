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
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
            <Gift className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display text-2xl tracking-tight">
            Bjud in andra — få kostnadsfri PRO
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="text-[14px] text-muted-foreground text-center leading-relaxed">
            Dela din affiliate-länk. När någon köper PRO via din länk får du:
            <br />• <strong>1 månad</strong> kostnadsfri PRO per månadsprenumerant
            <br />• <strong>3 månader</strong> kostnadsfri PRO per årsprenumerant
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-11 rounded-xl bg-surface-2 px-3 flex items-center text-[13px] font-mono truncate">
              {link}
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
            className="rounded-full text-[13px] text-muted-foreground"
          >
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
