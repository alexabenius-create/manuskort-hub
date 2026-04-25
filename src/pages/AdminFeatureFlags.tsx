import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";

interface FeatureFlag {
  id: string;
  flag_name: string;
  description: string | null;
  enabled_globally: boolean;
  enabled_for_user_ids: string[];
  enabled_for_tiers: string[];
  rollout_percentage: number;
  created_at: string;
  updated_at: string;
}

const TIERS = ["free", "pro", "admin"] as const;

export default function AdminFeatureFlags() {
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const navigate = useNavigate();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newUserIdByFlag, setNewUserIdByFlag] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tierLoading && tier !== "admin") {
      navigate("/bibliotek", { replace: true });
    }
  }, [tier, tierLoading, navigate]);

  useEffect(() => {
    if (!user || tier !== "admin") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("flag_name");
      if (cancelled) return;
      if (error) {
        toast({ title: "Kunde inte ladda feature flags", description: error.message, variant: "destructive" });
      } else {
        setFlags((data ?? []) as FeatureFlag[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, tier]);

  const updateLocal = (id: string, patch: Partial<FeatureFlag>) => {
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const save = async (flag: FeatureFlag) => {
    setSavingId(flag.id);
    const { error } = await supabase
      .from("feature_flags")
      .update({
        enabled_globally: flag.enabled_globally,
        enabled_for_user_ids: flag.enabled_for_user_ids,
        enabled_for_tiers: flag.enabled_for_tiers,
        rollout_percentage: flag.rollout_percentage,
      })
      .eq("id", flag.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sparad", description: flag.flag_name });
    }
  };

  const addUserId = (flag: FeatureFlag) => {
    const raw = (newUserIdByFlag[flag.id] ?? "").trim();
    if (!raw) return;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(raw)) {
      toast({ title: "Ogiltigt user_id", description: "Måste vara ett UUID.", variant: "destructive" });
      return;
    }
    if (flag.enabled_for_user_ids.includes(raw)) return;
    updateLocal(flag.id, { enabled_for_user_ids: [...flag.enabled_for_user_ids, raw] });
    setNewUserIdByFlag((s) => ({ ...s, [flag.id]: "" }));
  };

  const removeUserId = (flag: FeatureFlag, uid: string) => {
    updateLocal(flag.id, { enabled_for_user_ids: flag.enabled_for_user_ids.filter((x) => x !== uid) });
  };

  const toggleTier = (flag: FeatureFlag, t: string) => {
    const has = flag.enabled_for_tiers.includes(t);
    updateLocal(flag.id, {
      enabled_for_tiers: has ? flag.enabled_for_tiers.filter((x) => x !== t) : [...flag.enabled_for_tiers, t],
    });
  };

  if (tierLoading || tier !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Kontrollerar behörighet…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Feature flags – Admin" description="Hantera feature flags." />
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="-ml-2 gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
          <h1 className="text-sm font-medium ml-2">Feature flags</h1>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-5 sm:px-8 py-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga flags.</p>
        ) : (
          <div className="space-y-6">
            {flags.map((flag) => (
              <div key={flag.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">{flag.flag_name}</h2>
                    {flag.description && (
                      <p className="text-sm text-muted-foreground mt-1">{flag.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => save(flag)}
                    disabled={savingId === flag.id}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingId === flag.id ? "Sparar…" : "Spara"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Globalt */}
                  <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Aktiv globalt</p>
                      <p className="text-xs text-muted-foreground">Slår på för alla användare.</p>
                    </div>
                    <Switch
                      checked={flag.enabled_globally}
                      onCheckedChange={(v) => updateLocal(flag.id, { enabled_globally: v })}
                    />
                  </div>

                  {/* Tiers */}
                  <div className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-sm font-medium mb-2">Aktiv för tiers</p>
                    <div className="flex gap-2 flex-wrap">
                      {TIERS.map((t) => {
                        const on = flag.enabled_for_tiers.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleTier(flag, t)}
                            className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                              on
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:text-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Rollout */}
                <div className="rounded-lg border border-border bg-surface px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Rollout-procent</p>
                    <span className="text-sm font-mono text-foreground">{flag.rollout_percentage}%</span>
                  </div>
                  <Slider
                    value={[flag.rollout_percentage]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => updateLocal(flag.id, { rollout_percentage: v })}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Deterministisk per user_id-hash. 0 = av.
                  </p>
                </div>

                {/* Specifika user_ids */}
                <div className="rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-sm font-medium mb-2">Specifika användare (user_id)</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {flag.enabled_for_user_ids.length === 0 && (
                      <span className="text-xs text-muted-foreground">Inga.</span>
                    )}
                    {flag.enabled_for_user_ids.map((uid) => (
                      <Badge key={uid} variant="secondary" className="gap-1.5 font-mono text-[11px]">
                        {uid}
                        <button
                          type="button"
                          onClick={() => removeUserId(flag, uid)}
                          className="hover:text-destructive"
                          aria-label="Ta bort"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="UUID"
                      value={newUserIdByFlag[flag.id] ?? ""}
                      onChange={(e) =>
                        setNewUserIdByFlag((s) => ({ ...s, [flag.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addUserId(flag);
                        }
                      }}
                      className="font-mono text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => addUserId(flag)} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Lägg till
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
