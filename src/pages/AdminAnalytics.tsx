import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const PLATFORMS = ["all", "ios", "android", "macos", "windows", "linux", "other"] as const;
type PlatformFilter = (typeof PLATFORMS)[number];

interface MetricCard {
  label: string;
  value: string;
  hint: string;
}

interface AnalyticsRow {
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  occurred_at: string;
  platform: string | null;
}

interface RecentEventRow {
  id: string;
  occurred_at: string;
  event_name: string;
  // deno-lint-ignore no-explicit-any
  event_props: any;
  user_id: string | null;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s sedan`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min sedan`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h sedan`;
  const d = Math.round(h / 24);
  return `${d} d sedan`;
}

function formatProps(props: Record<string, unknown> | null | undefined): string {
  if (!props || typeof props !== "object") return "—";
  const keys = ["function_name", "model", "duration_ms", "outcome", "failure_reason", "error_kind", "source", "attempts", "has_attachment"];
  const parts: string[] = [];
  for (const k of keys) {
    if (k in props && props[k] !== null && props[k] !== undefined && props[k] !== "") {
      parts.push(`${k}=${String(props[k])}`);
    }
  }
  // Lägg till övriga props sist
  for (const [k, v] of Object.entries(props)) {
    if (keys.includes(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") continue;
    parts.push(`${k}=${String(v)}`);
  }
  return parts.length ? parts.join(", ") : "—";
}

export default function AdminAnalytics() {
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [recentEvents, setRecentEvents] = useState<RecentEventRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      let q = supabase
        .from("analytics_events")
        .select("user_id, session_id, event_name, occurred_at, platform")
        .gte("occurred_at", sevenDaysAgo)
        .order("occurred_at", { ascending: true })
        .limit(10000);
      if (platform !== "all") q = q.eq("platform", platform);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        console.error("[admin-analytics]", error);
        setRows([]);
      } else {
        setRows((data ?? []) as AnalyticsRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, tier, platform]);

  const fetchRecent = useCallback(async () => {
    if (!user || tier !== "admin") return;
    setRecentLoading(true);
    const { data, error } = await supabase
      .from("analytics_events")
      .select("id, occurred_at, event_name, event_props, user_id")
      .order("occurred_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error("[admin-analytics] recent", error);
      setRecentEvents([]);
    } else {
      setRecentEvents((data ?? []) as RecentEventRow[]);
    }
    setRecentLoading(false);
  }, [user, tier]);

  useEffect(() => {
    void fetchRecent();
    const interval = setInterval(() => void fetchRecent(), 30_000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  const metrics: MetricCard[] = useMemo(() => {
    const uniqueUsers = new Set<string>();
    let snabbstartCount = 0;
    let failedCount = 0;

    type Bucket = { firstSubmit?: number; firstToken?: number };
    const buckets = new Map<string, Bucket>();

    for (const r of rows) {
      if (r.user_id) uniqueUsers.add(r.user_id);
      if (r.event_name === "snabbstart_submitted") snabbstartCount++;
      if (r.event_name === "generation_failed") failedCount++;

      const key = `${r.user_id ?? "anon"}::${r.session_id ?? ""}`;
      const t = new Date(r.occurred_at).getTime();
      const b = buckets.get(key) ?? {};
      if (r.event_name === "snabbstart_submitted" && b.firstSubmit === undefined) {
        b.firstSubmit = t;
      } else if (
        r.event_name === "generation_first_token" &&
        b.firstSubmit !== undefined &&
        b.firstToken === undefined &&
        t >= b.firstSubmit
      ) {
        b.firstToken = t;
      }
      buckets.set(key, b);
    }

    const diffs: number[] = [];
    for (const b of buckets.values()) {
      if (b.firstSubmit !== undefined && b.firstToken !== undefined) {
        diffs.push(b.firstToken - b.firstSubmit);
      }
    }
    const avgMs = diffs.length === 0 ? null : diffs.reduce((a, c) => a + c, 0) / diffs.length;

    return [
      {
        label: "Unika användare",
        value: String(uniqueUsers.size),
        hint: "Med ≥1 event senaste 7 dagarna",
      },
      {
        label: "Snabbstart-användningar",
        value: String(snabbstartCount),
        hint: "snabbstart_submitted",
      },
      {
        label: "Snitt: Snabbstart → första token",
        value: avgMs === null ? "—" : `${(avgMs / 1000).toFixed(1)} s`,
        hint: `${diffs.length} matchningar`,
      },
      {
        label: "Misslyckade genereringar",
        value: String(failedCount),
        hint: "generation_failed",
      },
    ];
  }, [rows]);

  if (tierLoading || tier !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Kontrollerar behörighet…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Analytics – Admin" description="Översikt över Debatt-Buddy-användning." />
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="-ml-2 gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
          <h1 className="text-sm font-medium ml-2">Analytics – senaste 7 dagarna</h1>
          <div className="ml-auto inline-flex rounded-lg border border-border bg-surface p-1">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
                  platform === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-5 sm:px-8 py-8 space-y-10">
        {loading ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className="text-3xl font-semibold mt-2">{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.hint}</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Begränsat till 10 000 events. Filter: plattform = <span className="font-mono">{platform}</span>.
        </p>

        {/* ============== Senaste 20 händelser ============== */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Senaste 20 händelser</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void fetchRecent()}
              disabled={recentLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${recentLoading ? "animate-spin" : ""}`} />
              Uppdatera
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tidpunkt</th>
                    <th className="px-3 py-2 text-left font-medium">Event</th>
                    <th className="px-3 py-2 text-left font-medium">Props</th>
                    <th className="px-3 py-2 text-left font-medium">Användare</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.length === 0 && !recentLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        Inga händelser
                      </td>
                    </tr>
                  ) : (
                    recentEvents.map((ev) => {
                      const props = (ev.event_props ?? {}) as Record<string, unknown>;
                      const isFailed =
                        props.outcome === "failed" ||
                        ev.event_name === "generation_failed" ||
                        ev.event_name === "llm_timeout";
                      const dur = Number(props.duration_ms);
                      const isSlow = Number.isFinite(dur) && dur > 30_000 && !isFailed;
                      const userTag = ev.user_id ? `user_${ev.user_id.slice(0, 8)}` : "anon";
                      return (
                        <tr
                          key={ev.id}
                          className={`border-t border-border ${
                            isFailed
                              ? "bg-destructive/5 border-l-4 border-l-destructive"
                              : isSlow
                              ? "bg-amber-500/5 border-l-4 border-l-amber-500"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {relativeTime(ev.occurred_at)}
                          </td>
                          <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap">
                            {ev.event_name}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
                            {formatProps(props)}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {userTag}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Auto-refresh var 30:e sekund. Röd = failed, gul = långsam (&gt;30s).
          </p>
        </section>
      </main>
    </div>
  );
}
