import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "landing" | "library" | "editor";
  manuscriptId?: string | null;
}

const schema = z.object({
  subject: z.string().trim().min(2, "Skriv ett kort ämne").max(120, "Max 120 tecken"),
  body: z.string().trim().min(5, "Skriv ditt meddelande").max(2000, "Max 2000 tecken"),
  email: z.string().trim().email("Ogiltig e-post").max(255).optional().or(z.literal("")),
});

export function FeedbackDialog({ open, onOpenChange, source, manuscriptId }: Props) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSubject("");
    setBody("");
    setEmail("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      subject,
      body,
      email: user ? "" : email,
    });
    if (!parsed.success) {
      toast({
        title: "Kontrollera fälten",
        description: parsed.error.issues[0]?.message ?? "Ogiltigt formulär",
        variant: "destructive",
      });
      return;
    }
    if (!user && !email.trim()) {
      toast({ title: "E-post krävs", description: "Vi behöver en e-post för att kunna svara.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data: thread, error: threadError } = await supabase
      .from("feedback_threads")
      .insert({
        user_id: user?.id ?? null,
        email: user?.email ?? email.trim() ?? null,
        subject: subject.trim(),
        source,
        manuscript_id: manuscriptId ?? null,
      })
      .select("id")
      .single();

    if (threadError || !thread) {
      setSubmitting(false);
      toast({ title: "Misslyckades", description: threadError?.message ?? "Kunde inte skicka", variant: "destructive" });
      return;
    }

    const { error: msgError } = await supabase.from("feedback_messages").insert({
      thread_id: thread.id,
      sender_role: "user",
      sender_user_id: user?.id ?? null,
      body: body.trim(),
    });

    setSubmitting(false);

    if (msgError) {
      toast({ title: "Misslyckades", description: msgError.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Tack för din feedback!",
      description: user ? "Du hittar svaret under Mina meddelanden." : "Vi svarar på din e-post.",
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-semibold tracking-tight">
            Skicka feedback
          </DialogTitle>
          <DialogDescription className="text-[14px] text-muted-foreground">
            Berätta vad du tycker, vad som saknas eller om något krånglar. Vi läser allt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!user && (
            <div className="space-y-1.5">
              <Label htmlFor="fb-email" className="text-[13px]">E-post</Label>
              <Input
                id="fb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.se"
                className="h-10 rounded-xl"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fb-subject" className="text-[13px]">Ämne</Label>
            <Input
              id="fb-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="t.ex. Förslag på ny funktion"
              className="h-10 rounded-xl"
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-body" className="text-[13px]">Meddelande</Label>
            <Textarea
              id="fb-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Skriv så detaljerat du vill…"
              className="min-h-[140px] rounded-xl resize-none"
              maxLength={2000}
              required
            />
            <p className="text-[11px] text-muted-foreground text-right">{body.length} / 2000</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-full"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Skickar…" : "Skicka"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
