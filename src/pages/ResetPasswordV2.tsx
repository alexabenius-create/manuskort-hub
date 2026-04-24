import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import manuskortLogo from "@/assets/manuskort-logo.png";

export default function ResetPasswordV2() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
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
      navigate("/bibliotek-v2", { replace: true });
    } catch (err: any) {
      toast({ title: "Något gick fel", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-v2-bg text-v2-ink relative overflow-hidden flex items-center justify-center px-6 py-12">
      <SEO title="Återställ lösenord – Manuskort" description="Sätt ett nytt lösenord för ditt konto." noindex />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(99,102,241,0.32) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,0.26) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-[440px]">
        <header className="text-center mb-10 v2-reveal">
          <img src={manuskortLogo} alt="Manuskort" className="h-9 w-auto mx-auto mb-5" />
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.025em] text-v2-ink">
            <span className="bg-gradient-to-r from-v2-violet via-v2-blue to-v2-pink bg-clip-text text-transparent">
              Manuskort
            </span>
          </h1>
          <p className="text-v2-muted mt-3 text-[15px]">Sätt ett nytt lösenord</p>
        </header>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-v2-line shadow-[0_20px_60px_-20px_rgba(99,102,241,0.25)] p-8">
          {!ready ? (
            <p className="text-[14px] text-v2-muted text-center">
              Öppna återställningslänken från din e-post för att fortsätta.
            </p>
          ) : (
            <form onSubmit={handle} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pwd" className="text-[13px] text-v2-muted font-medium">Nytt lösenord</Label>
                <Input
                  id="pwd"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="h-11 rounded-xl bg-white border border-v2-line text-[15px] focus-visible:ring-2 focus-visible:ring-v2-violet"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd2" className="text-[13px] text-v2-muted font-medium">Bekräfta lösenord</Label>
                <Input
                  id="pwd2"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  className="h-11 rounded-xl bg-white border border-v2-line text-[15px] focus-visible:ring-2 focus-visible:ring-v2-violet"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="v2-btn-primary w-full justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">{busy ? "Sparar…" : "Spara nytt lösenord"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
