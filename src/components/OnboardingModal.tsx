import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface OnboardingModalProps {
  open: boolean;
  userId: string;
  onComplete: () => void;
}

export function OnboardingModal({ open, userId, onComplete }: OnboardingModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      toast({ title: "Förnamn krävs", description: "Fyll i ditt förnamn för att fortsätta.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const displayName = [trimmedFirst, lastName.trim()].filter(Boolean).join(" ");
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: trimmedFirst,
          last_name: lastName.trim() || null,
          company: company.trim() || null,
          display_name: displayName,
          onboarding_completed: true,
        })
        .eq("user_id", userId);
      if (error) throw error;
      onComplete();
    } catch (err: any) {
      toast({ title: "Något gick fel", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* not dismissible */ }}>
      <DialogContent
        className="sm:max-w-[440px] rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-semibold tracking-tight">
            Välkommen! Vad ska vi kalla dig?
          </DialogTitle>
          <DialogDescription className="text-[14px] text-muted-foreground">
            Vi använder ditt namn för att personalisera Manuskort.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ob-first" className="text-[13px] text-muted-foreground font-medium">
              Förnamn <span className="text-foreground">*</span>
            </Label>
            <Input
              id="ob-first"
              required
              autoFocus
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={80}
              className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-last" className="text-[13px] text-muted-foreground font-medium">
              Efternamn
            </Label>
            <Input
              id="ob-last"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={80}
              className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-company" className="text-[13px] text-muted-foreground font-medium">
              Företag <span className="text-muted-foreground/60">(frivilligt)</span>
            </Label>
            <Input
              id="ob-company"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={120}
              className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
            />
          </div>

          <Button
            type="submit"
            disabled={busy || !firstName.trim()}
            className="w-full h-11 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white font-medium text-[15px] mt-2"
          >
            {busy ? "Sparar…" : "Fortsätt"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
