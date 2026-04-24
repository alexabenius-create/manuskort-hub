import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Sparkles } from "lucide-react";
import type { Insight } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  insight: Insight;
  onSent: () => void;
}

const DEFAULT_SUBJECT = "Din feedback är implementerad ✨";

function buildDefaultBody(insight: Insight) {
  const snippet = insight.raw_text.trim().slice(0, 140);
  return `Hej!

Tack för din feedback om "${snippet}${insight.raw_text.length > 140 ? "…" : ""}".

Vi har nu byggt det du föreslog och funktionen är live. Hör gärna av dig om det fungerar som du tänkt eller om du har fler tankar — varje synpunkt gör Manuskort bättre.

/Manuskort`;
}

export function SendFeedbackDialog({ open, onOpenChange, insight, onSent }: Props) {
  const { user } = useAuth();
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(buildDefaultBody(insight));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(DEFAULT_SUBJECT);
      setBody(buildDefaultBody(insight));
    }
  }, [open, insight]);

  const handleSend = async () => {
    if (!user || !insight.linked_user_id || !body.trim()) return;
    setSending(true);

    try {
      let threadId = insight.linked_thread_id;

      if (threadId) {
        // Återöppna tråden om den är stängd
        const { data: t } = await supabase
          .from("feedback_threads")
          .select("status")
          .eq("id", threadId)
          .maybeSingle();
        if (t?.status === "closed") {
          await supabase.from("feedback_threads").update({ status: "open" }).eq("id", threadId);
        }
      } else {
        // Skapa ny tråd
        const { data: newThread, error: threadErr } = await supabase
          .from("feedback_threads")
          .insert({
            user_id: insight.linked_user_id,
            email: null,
            subject: subject.trim() || DEFAULT_SUBJECT,
            source: "insight",
            status: "open",
          })
          .select("id")
          .single();
        if (threadErr || !newThread) {
          throw new Error(threadErr?.message ?? "Kunde inte skapa tråd");
        }
        threadId = newThread.id;
      }

      const { error: msgErr } = await supabase.from("feedback_messages").insert({
        thread_id: threadId,
        sender_role: "admin",
        sender_user_id: user.id,
        body: body.trim(),
      });
      if (msgErr) throw new Error(msgErr.message);

      // Spara på insikten
      await supabase
        .from("admin_insights")
        .update({
          feedback_sent_at: new Date().toISOString(),
          linked_thread_id: threadId,
        })
        .eq("id", insight.id);

      toast({ title: "Återkoppling skickad", description: "Användaren får meddelandet i sin inkorg." });
      onSent();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Kunde inte skicka",
        description: e instanceof Error ? e.message : "Okänt fel",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-blue" />
            Skicka återkoppling till användaren
          </DialogTitle>
          <DialogDescription>
            Användaren får meddelandet direkt i sin inkorg under "Meddelanden". Du kan redigera texten innan du skickar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!insight.linked_thread_id && (
            <div>
              <Label htmlFor="subject">Ämne</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}
          {insight.linked_thread_id && (
            <p className="text-[12px] text-muted-foreground bg-accent-blue/5 px-3 py-2 rounded-lg border border-accent-blue/20">
              Meddelandet postas i den befintliga feedback-tråden.
            </p>
          )}
          <div>
            <Label htmlFor="body">Meddelande</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="mt-1.5"
            />
          </div>
          {insight.feedback_sent_at && (
            <p className="text-[12px] text-muted-foreground italic">
              Senast skickad {new Date(insight.feedback_sent_at).toLocaleString("sv-SE")}.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
            Avbryt
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Skickar…" : "Skicka återkoppling"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
