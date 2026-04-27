import { useState } from "react";
import { Copy, Check, Gift, Users, TrendingUp, Loader2 } from "lucide-react";
import { useAffiliate } from "@/hooks/useAffiliate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AffiliateSection() {
  const { link, stats, loading } = useAffiliate();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!link) return;
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
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Affiliate-program</h2>
      <p className="text-[14px] text-muted-foreground -mt-2">
        Bjud in andra till Manuskort och få <strong>kostnadsfri PRO</strong> — det
        fungerar även om du själv är gratisanvändare:
        <br />• 1 månad per värvad månadsprenumerant
        <br />• 3 månader per värvad årsprenumerant
      </p>

      <div className="bg-surface rounded-2xl shadow-card px-5 py-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground font-medium">Din affiliate-länk</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-11 rounded-xl bg-surface-2 px-3 flex items-center text-[14px] font-mono truncate">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                link
              )}
            </div>
            <Button
              type="button"
              onClick={onCopy}
              disabled={!link || loading}
              className="h-11 rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5 shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Kopierad" : "Kopiera"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <Stat
            icon={<Users className="h-4 w-4" />}
            value={stats?.signups ?? 0}
            label="Konton skapade"
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            value={stats?.conversions ?? 0}
            label="PRO-köp"
          />
          <Stat
            icon={<Gift className="h-4 w-4" />}
            value={stats?.total_months ?? 0}
            label="Månader intjänat"
          />
        </div>

        {stats?.active_until && (
          <p className="text-[12px] text-muted-foreground pt-1">
            🎉 Du har aktiv kostnadsfri PRO via affiliate-program till{" "}
            <strong>{new Date(stats.active_until).toLocaleDateString("sv-SE")}</strong>.
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-surface-2 rounded-xl px-3 py-3 flex flex-col gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[20px] font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}
