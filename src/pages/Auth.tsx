import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Mode = "magic" | "password" | "signup";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast({ title: "Kolla din e-post", description: "Vi har skickat en magisk länk." });
      } else if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast({ title: "Konto skapat", description: "Verifiera din e-post om det krävs, sen är du inne." });
      }
    } catch (err: any) {
      toast({ title: "Något gick fel", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <header className="text-center mb-10">
          <h1 className="font-serif text-4xl tracking-tight">Manuskort</h1>
          <p className="font-serif italic text-faint mt-2">Manus i kortformat. För talare och moderatorer.</p>
        </header>

        <div className="bg-surface border-hair-strong rounded-lg p-8 shadow-sm">
          <div className="flex gap-px font-mono text-xs uppercase tracking-widest mb-6">
            {([
              ["magic", "Magisk länk"],
              ["password", "Logga in"],
              ["signup", "Skapa konto"],
            ] as [Mode, string][]).map(([m, label], i, arr) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 px-2 border-hair-strong transition-colors ${
                  mode === m ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:bg-surface-2"
                } ${i === 0 ? "rounded-l-md" : ""} ${i === arr.length - 1 ? "rounded-r-md" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-widest text-faint">E-post</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@exempel.se"
                className="font-serif"
              />
            </div>

            {mode !== "magic" && (
              <div className="space-y-2">
                <Label htmlFor="pwd" className="font-mono text-[11px] uppercase tracking-widest text-faint">Lösenord</Label>
                <Input
                  id="pwd"
                  type="password"
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="font-mono"
                />
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full font-mono text-xs uppercase tracking-widest h-11">
              {busy ? "Skickar…" : mode === "magic" ? "Skicka länk" : mode === "password" ? "Logga in" : "Skapa konto"}
            </Button>
          </form>

          {mode === "signup" && (
            <p className="font-serif italic text-xs text-faint mt-6 leading-relaxed">
              Dina manus sparas i molnet och är endast synliga för dig. Du kan när som helst radera ditt konto och all data.
            </p>
          )}
        </div>

        <p className="font-mono text-[10px] uppercase tracking-widest text-faint text-center mt-8">
          Du förblir inloggad i 30 dagar
        </p>
      </div>
    </div>
  );
}
