import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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

export default function AdminAnalytics() {
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<PlatformFilter>("all");

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

  const metrics: MetricCard[] = useMemo(() => {
    const uniqueUsers = new Set<string>();
    let snabbstartCount = 0;
    let failedCount = 0;

    // För avg-time-to-first-token: per (user_id|session_id), ta första snabbstart_submitted
    // och första efterföljande generation_first_token, mät diff.
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

      <main className="max-w-[1100px] mx-auto px-5 sm:px-8 py-8">
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
        <p className="text-xs text-muted-foreground mt-6">
          Begränsat till 10 000 events. Filter: plattform = <span className="font-mono">{platform}</span>.
        </p>
      </main>
    </div>
  );
}
