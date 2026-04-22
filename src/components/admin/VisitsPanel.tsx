import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface VisitRow {
  id: string;
  path: string;
  ip_hash: string;
  country: string | null;
  referrer: string | null;
  user_agent: string | null;
  notified: boolean;
  created_at: string;
}

function shortUA(ua: string | null): string {
  if (!ua) return "okänd";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" :
    "okänd";
  const os =
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" :
    "";
  return os ? `${browser} ${os}` : browser;
}

function shortRef(ref: string | null): string {
  if (!ref) return "direkt";
  try { return new URL(ref).hostname.replace(/^www\./, ""); } catch { return "direkt"; }
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} · ${d.toLocaleDateString("sv-SE")}`;
}

export function VisitsPanel() {
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("site_visits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setRows((data ?? []) as VisitRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const today = rows.filter((r) => now - new Date(r.created_at).getTime() < dayMs).length;
    const week = rows.filter((r) => now - new Date(r.created_at).getTime() < 7 * dayMs).length;
    const uniqueIps = new Set(rows.map((r) => r.ip_hash)).size;
    return { today, week, total: rows.length, uniqueIps };
  }, [rows]);

  // Mark first occurrence per ip_hash as "ny"
  const seen = new Set<string>();
  const annotated = [...rows].reverse().map((r) => {
    const isNew = !seen.has(r.ip_hash);
    seen.add(r.ip_hash);
    return { ...r, isNew };
  }).reverse();

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface rounded-2xl p-4 shadow-card">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Idag</div>
          <div className="text-2xl font-display font-semibold tabular-nums">{stats.today}</div>
        </div>
        <div className="bg-surface rounded-2xl p-4 shadow-card">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">7 dagar</div>
          <div className="text-2xl font-display font-semibold tabular-nums">{stats.week}</div>
        </div>
        <div className="bg-surface rounded-2xl p-4 shadow-card">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Unika IP</div>
          <div className="text-2xl font-display font-semibold tabular-nums">{stats.uniqueIps}</div>
        </div>
        <div className="bg-surface rounded-2xl p-4 shadow-card">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Totalt (200 senaste)</div>
          <div className="text-2xl font-display font-semibold tabular-nums">{stats.total}</div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <p className="text-center text-muted-foreground py-16">Laddar besök…</p>
        ) : annotated.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">Inga besök ännu.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-hair">
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Tid</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Land</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Från</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Enhet</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[100px]">Typ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annotated.map((r) => (
                <TableRow key={r.id} className="border-b-hair hover:bg-surface-2/40">
                  <TableCell className="text-[13px] tabular-nums">{fmtTime(r.created_at)}</TableCell>
                  <TableCell className="text-[13px]">{r.country ?? "—"}</TableCell>
                  <TableCell className="text-[13px]">{shortRef(r.referrer)}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{shortUA(r.user_agent)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                      r.isNew
                        ? "bg-[hsl(var(--cue-teal))]/15 text-[hsl(var(--cue-teal))] ring-1 ring-[hsl(var(--cue-teal))]/40"
                        : "bg-surface-2 text-muted-foreground"
                    }`}>
                      {r.isNew ? "NY" : "ÅTER"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
