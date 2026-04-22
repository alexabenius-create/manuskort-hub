import { Link } from "react-router-dom";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyActiveShares } from "@/hooks/useShareRequests";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

/**
 * Globalt rött band överst i Library/Messages när användaren har en eller flera
 * aktiva delningar med Admin. Klick på "Sluta dela" återkallar omedelbart.
 */
export function OwnerSupportBanner() {
  const shares = useMyActiveShares();
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const ids = shares.map((s) => s.manuscript_id).filter((x): x is string => !!x);
    if (ids.length === 0) {
      setTitles({});
      return;
    }
    supabase
      .from("manuscripts")
      .select("id, title")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((m) => {
          map[m.id] = m.title;
        });
        setTitles(map);
      });
  }, [shares]);

  if (shares.length === 0) return null;

  const revokeAll = async () => {
    setWorking(true);
    const { error } = await supabase
      .from("manuscript_share_requests")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .in("id", shares.map((s) => s.id));
    setWorking(false);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Delning avslutad", description: "Admin har inte längre tillgång." });
  };

  const single = shares.length === 1;
  const titleText = single
    ? titles[shares[0].manuscript_id ?? ""] ?? "ett av dina manus"
    : `${shares.length} av dina manus`;

  return (
    <div className="bg-destructive/10 border-b border-destructive/30 px-6 sm:px-10 py-2.5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-[13px] text-foreground min-w-0">
        <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
        <span className="truncate">
          Admin kan just nu redigera <span className="font-semibold">{titleText}</span>.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost" className="rounded-full h-7 text-[12px] text-muted-foreground">
          <Link to="/meddelanden">Visa tråd</Link>
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={revokeAll}
          disabled={working}
          className="rounded-full h-7 text-[12px] gap-1"
        >
          <X className="h-3 w-3" />
          Sluta dela
        </Button>
      </div>
    </div>
  );
}

interface SupportEditorBannerProps {
  ownerEmail: string | null;
  manuscriptTitle: string;
  onClose: () => void;
}

/**
 * Band som visas överst i editorn när admin är i stödläge (?support=...).
 */
export function SupportEditorBanner({ ownerEmail, manuscriptTitle, onClose }: SupportEditorBannerProps) {
  return (
    <div className="bg-[hsl(var(--cue-amber))]/15 border-b-2 border-[hsl(var(--cue-amber))]/50 px-6 sm:px-10 py-2.5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-[13px] text-foreground min-w-0">
        <ShieldAlert className="h-4 w-4 text-[hsl(var(--cue-amber))] flex-shrink-0" />
        <span className="truncate">
          <span className="font-bold uppercase tracking-wide text-[11px] mr-2 text-[hsl(var(--cue-amber))]">Stödläge</span>
          Du redigerar <span className="font-semibold">"{manuscriptTitle}"</span>
          {ownerEmail && <> som tillhör <span className="font-medium">{ownerEmail}</span></>}.
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClose}
        className="rounded-full h-7 text-[12px] gap-1"
      >
        <X className="h-3 w-3" />
        Stäng support-vy
      </Button>
    </div>
  );
}
