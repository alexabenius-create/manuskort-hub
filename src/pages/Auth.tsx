import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

type Mode = "magic" | "password" | "signup" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/bibliotek` },
        });
        if (error) throw error;
        toast({ title: "Kolla din e-post", description: "Vi har skickat en magisk länk." });
      } else if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/bibliotek", { replace: true });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/aterstall-losenord`,
        });
        if (error) throw error;
        toast({ title: "Kolla din e-post", description: "Vi har skickat en länk för att återställa ditt lösenord." });
      } else {
        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();
        if (!trimmedFirst) {
          throw new Error("Förnamn krävs.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/bibliotek`,
            data: { first_name: trimmedFirst, last_name: trimmedLast },
          },
        });
        if (error) throw error;

        // Om användaren skapas direkt (auto-confirm eller redan inloggad session) — uppdatera profilen
        const userId = data.user?.id;
        if (userId) {
          const displayName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ");
          // Best-effort — om ingen session finns ännu (email-bekräftelse krävs) görs detta vid första inloggning via OnboardingModal
          await supabase
            .from("profiles")
            .update({
              first_name: trimmedFirst,
              last_name: trimmedLast || null,
              display_name: displayName,
              onboarding_completed: true,
            })
            .eq("user_id", userId);
        }

        // Markera att välkomstpopup ska visas i biblioteket innan rundturen startar.
        try {
          sessionStorage.setItem("mk:welcome-pending", email);
        } catch { /* ignore */ }

        // Navigera direkt in i biblioteket — auto-confirm är aktiverat så session finns.
        if (data.session) {
          navigate("/bibliotek", { replace: true });
        } else {
          // Fallback: ingen session (kan hända om e-postbekräftelse är på). Försök logga in.
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            toast({ title: "Konto skapat", description: "Logga in för att fortsätta." });
            setMode("password");
          } else {
            navigate("/bibliotek", { replace: true });
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Något gick fel", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const tabs: [Mode, string][] = [
    ["magic", "Magisk länk"],
    ["password", "Logga in"],
    ["signup", "Skapa konto"],
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <SEO title="Logga in – Manuskort" description="Logga in eller skapa konto." noindex />
      <div className="w-full max-w-[420px]">
        <header className="text-center mb-12">
          <h1 className="font-display text-5xl font-semibold tracking-tight">Manuskort</h1>
          <p className="text-muted-foreground mt-3 text-[15px]">
            Manus i kortformat. För talare och moderatorer.
          </p>
        </header>

        <div className="bg-surface rounded-2xl shadow-card p-8">
          <div className="seg-group w-full mb-7">
            {tabs.map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                data-active={mode === m}
                className="seg-btn flex-1"
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-[13px] text-muted-foreground font-medium">
                    Förnamn
                  </Label>
                  <Input
                    id="first-name"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={80}
                    className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-[13px] text-muted-foreground font-medium">
                    Efternamn
                  </Label>
                  <Input
                    id="last-name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={80}
                    className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] text-muted-foreground font-medium">E-post</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@exempel.se"
                className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
              />
            </div>

            {(mode === "password" || mode === "signup") && (
              <div className="space-y-1.5">
                <Label htmlFor="pwd" className="text-[13px] text-muted-foreground font-medium">Lösenord</Label>
                <Input
                  id="pwd"
                  type="password"
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="h-11 rounded-xl bg-surface-2 border-0 text-[15px] focus-visible:ring-2 focus-visible:ring-accent-blue"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white font-medium text-[15px] mt-2"
            >
              {busy
                ? "Skickar…"
                : mode === "magic"
                ? "Skicka länk"
                : mode === "password"
                ? "Logga in"
                : mode === "forgot"
                ? "Skicka återställningslänk"
                : "Skapa konto"}
            </Button>
          </form>

          {mode === "password" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="block mx-auto mt-5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Glömt lösenord?
            </button>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("password")}
              className="block mx-auto mt-5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Tillbaka till logga in
            </button>
          )}

          {mode === "signup" && (
            <p className="text-[13px] text-muted-foreground mt-6 leading-relaxed">
              Dina manus sparas i molnet och är endast synliga för dig. Du kan när som helst radera ditt konto och all data.
            </p>
          )}
        </div>

        <p className="text-[12px] text-muted-foreground text-center mt-8">
          Du förblir inloggad i 30 dagar
        </p>
      </div>
    </div>
  );
}
