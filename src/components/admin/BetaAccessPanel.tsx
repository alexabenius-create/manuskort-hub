import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const FEATURE_KEY = "debate_buddy";
const FEATURE_LABEL = "Debatt-buddy";

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  tier: "free" | "pro" | "admin";
}

export function BetaAccessPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: usersData, error: usersErr }, { data: betaData, error: betaErr }] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("beta_features").select("user_id, feature").eq("feature", FEATURE_KEY),
    ]);

    if (usersErr) {
      toast({ title: "Kunde inte ladda användare", description: usersErr.message, variant: "destructive" });
    }
    if (betaErr) {
      toast({ title: "Kunde inte ladda BETA-tillstånd", description: betaErr.message, variant: "destructive" });
    }

    setUsers((usersData ?? []) as UserRow[]);
    setGranted(new Set((betaData ?? []).map((r: any) => r.user_id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (userId: string, on: boolean) => {
    setSavingId(userId);
    if (on) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("beta_features")
        .insert({ user_id: userId, feature: FEATURE_KEY, granted_by: user?.id ?? null });
      if (error) {
        toast({ title: "Kunde inte ge tillgång", description: error.message, variant: "destructive" });
      } else {
        setGranted((prev) => new Set(prev).add(userId));
      }
    } else {
      const { error } = await supabase
        .from("beta_features")
        .delete()
        .eq("user_id", userId)
        .eq("feature", FEATURE_KEY);
      if (error) {
        toast({ title: "Kunde inte ta bort tillgång", description: error.message, variant: "destructive" });
      } else {
        setGranted((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    }
    setSavingId(null);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) => {
      const hay = `${u.email ?? ""} ${u.display_name ?? ""} ${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [users, q]);

  return (
    <div>
      <div className="mb-8 v2-reveal">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">BETA-tillgång</h2>
        <p className="text-v2-muted text-[15px] mt-2">
          Lås upp BETA-funktioner per användare. Admin har alltid tillgång.
        </p>
      </div>

      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-v2-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök e-post eller namn"
          className="pl-11 h-11 rounded-full bg-white/80 backdrop-blur border border-v2-line text-[14px] focus-visible:ring-2 focus-visible:ring-v2-violet"
        />
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-v2-line flex items-center gap-2 text-[12px] uppercase tracking-wider text-v2-muted font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-v2-violet" />
          {FEATURE_LABEL}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-v2-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-v2-muted text-[14px]">Inga användare matchar.</div>
        ) : (
          <ul className="divide-y divide-v2-line">
            {filtered.map((u) => {
              const isGranted = granted.has(u.user_id);
              const isAdmin = u.tier === "admin";
              return (
                <li key={u.user_id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-v2-ink truncate">
                      {u.display_name || `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email}
                    </div>
                    <div className="text-[12px] text-v2-muted truncate">{u.email}</div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-v2-muted">
                    {u.tier === "admin" ? "Admin" : u.tier === "pro" ? "PRO" : "Gratis"}
                  </span>
                  {isAdmin ? (
                    <span className="text-[12px] text-v2-muted italic w-12 text-right">auto</span>
                  ) : (
                    <Switch
                      checked={isGranted}
                      disabled={savingId === u.user_id}
                      onCheckedChange={(v) => toggle(u.user_id, v)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
