import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldQuestion, ShieldCheck, ShieldX, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useThreadShareRequests } from "@/hooks/useShareRequests";

interface Props {
  threadId: string;
  /** Manus-ägaren (tråd-skaparen). Null = anonym landing-tråd, då kan delning inte begäras. */
  threadUserId: string | null;
}

/**
 * Admins panel inuti en feedback-tråd för att begära/öppna manus-delning.
 */
export function AdminShareRequestPanel({ threadId, threadUserId }: Props) {
  const { user } = useAuth();
  const { items, loading } = useThreadShareRequests(threadId);
  const [working, setWorking] = useState(false);

  if (!threadUserId) {
    return (
      <div className="rounded-xl bg-surface-2/40 border border-border/40 px-3 py-2 text-[12px] text-muted-foreground italic">
        Anonym tråd — delning kräver inloggad användare.
      </div>
    );
  }

  const active = items.find((r) => r.status === "granted");
  const pending = items.find((r) => r.status === "pending");

  const requestAccess = async () => {
    if (!user) return;
    setWorking(true);
    const { error: shareErr } = await supabase
      .from("manuscript_share_requests")
      .insert({
        thread_id: threadId,
        requested_by: user.id,
        user_id: threadUserId,
        status: "pending",
      });
    if (shareErr) {
      setWorking(false);
      toast({ title: "Misslyckades", description: shareErr.message, variant: "destructive" });
      return;
    }
    // Poste system-meddelande i tråden
    await supabase.from("feedback_messages").insert({
      thread_id: threadId,
      sender_role: "admin",
      sender_user_id: user.id,
      body: "🔐 Jag har skickat en begäran om att få redigera ett av dina manus för att hjälpa dig. Du kan godkänna eller avslå begäran nedan.",
    });
    setWorking(false);
    toast({ title: "Begäran skickad", description: "Användaren ser den i sin tråd." });
  };

  const cancelPending = async (id: string) => {
    setWorking(true);
    await supabase
      .from("manuscript_share_requests")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id);
    setWorking(false);
  };

  if (loading) {
    return <div className="text-[12px] text-muted-foreground">Laddar delning…</div>;
  }

  return (
    <div className="rounded-xl bg-surface-2/40 border border-border/40 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        <ShieldQuestion className="h-3 w-3" />
        Manus-delning
      </div>

      {active ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--cue-teal))]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Aktiv delning
          </div>
          <Button
            size="sm"
            asChild
            className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white h-7 text-[12px] gap-1"
          >
            <a href={`/manus/${active.manuscript_id}?support=${active.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Öppna delat manus
            </a>
          </Button>
        </div>
      ) : pending ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <ShieldQuestion className="h-3.5 w-3.5" />
            Väntar på användarens svar…
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => cancelPending(pending.id)}
            disabled={working}
            className="rounded-full h-7 text-[12px] text-muted-foreground gap-1"
          >
            <ShieldX className="h-3 w-3" />
            Avbryt
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={requestAccess}
          disabled={working}
          className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white h-7 text-[12px] gap-1"
        >
          <ShieldQuestion className="h-3 w-3" />
          Be om tillgång till manus
        </Button>
      )}
    </div>
  );
}
