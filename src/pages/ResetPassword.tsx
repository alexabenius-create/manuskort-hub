import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parsar recovery-token från URL automatiskt och triggar PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Kolla även om vi redan har en session (t.ex. efter klick på återställningslänk)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "För kort lösenord", description: "Minst 8 tecken.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Lösenorden matchar inte", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Lösenord uppdaterat", description: "Du är nu inloggad." });
      navigate("/bibliotek", { replace: true });
    } catch (err: any) {
      toast({ title: "Något gick fel", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <SEO title="Återställ lösenord – Manuskort" description="Sätt ett nytt lösenord för ditt konto." noindex />
      <div className="w-full max-w-[420px]">
        <header className="text-center mb-12">
          <h1 className="font-display text-5xl font-semibold tracking-tight">Manuskort</h1>
          <p className="text-muted-foreground mt-3 text-[15px]">Sätt ett nytt lösenord</p>
        </header>

        <div className="bg-surface rounded-2xl shadow-card p-8">
          {!ready ? (
            <p className="text-[14px] text-muted-foreground text-center">
              Öppna återställningslänken från din e-post för att fortsätta.
            </p>
          ) : (
            <form onSubmit={handle} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pwd" className="text-[13px] text-muted-foreground font-medium">Nytt lösenord</Label>
                <Input
                  id="pwd"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd2" className="text-[13px] text-muted-foreground font-medium">Bekräfta lösenord</Label>
                <Input
                  id="pwd2"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white font-medium text-[15px] mt-2"
              >
                {busy ? "Sparar…" : "Spara nytt lösenord"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
