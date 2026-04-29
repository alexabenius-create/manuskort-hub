// Admin-vy för alla översättningsnycklar — sökbar, filtrerbar, audit-logg per nyckel.

import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTier } from "@/hooks/useTier";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TranslationEditPopover } from "@/i18n/TranslationEditPopover";
import svResources from "@/i18n/locales/sv.json";
import enResources from "@/i18n/locales/en.json";
import { Pencil, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Filter = "all" | "manual" | "ai" | "missing" | "outdated";

interface OverrideRow {
  key: string;
  language: string;
  source_text: string;
  source_text_at_override: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

interface HistoryRow {
  key: string;
  language: string;
  old_value: string | null;
  new_value: string | null;
  action: string;
  changed_at: string;
  changed_by: string | null;
}

function flatten(obj: any, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v, key));
  }
  return out;
}

export default function AdminTranslations() {
  const { isAdmin, loading: tierLoading } = useTier();
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const svFlat = useMemo(() => flatten(svResources), []);
  const enFlat = useMemo(() => flatten(enResources), []);

  const loadOverrides = async () => {
    const { data } = await supabase
      .from("translation_overrides")
      .select("*")
      .eq("language", "en");
    const map: Record<string, OverrideRow> = {};
    (data ?? []).forEach((r: any) => (map[r.key] = r));
    setOverrides(map);
  };

  useEffect(() => {
    if (isAdmin) void loadOverrides();
  }, [isAdmin]);

  useEffect(() => {
    if (!historyKey) return;
    void supabase
      .from("translation_override_history")
      .select("*")
      .eq("key", historyKey)
      .eq("language", "en")
      .order("changed_at", { ascending: false })
      .then(({ data }) => setHistory((data ?? []) as HistoryRow[]));
  }, [historyKey]);

  if (tierLoading) return <div className="p-8 text-muted-foreground">Laddar…</div>;
  if (!isAdmin) return <Navigate to="/bibliotek" replace />;

  const allKeys = Array.from(new Set([...Object.keys(svFlat), ...Object.keys(overrides)]));

  const rows = allKeys
    .map((key) => {
      const sv = svFlat[key] ?? "";
      const ai = enFlat[key] ?? "";
      const ov = overrides[key];
      const isManual = !!ov;
      const isMissing = !ai && !ov;
      const isOutdated = !!ov && ov.source_text_at_override !== sv;
      return { key, sv, ai, manual: ov?.value ?? "", isManual, isMissing, isOutdated, updated_at: ov?.updated_at };
    })
    .filter((r) => {
      if (filter === "manual" && !r.isManual) return false;
      if (filter === "ai" && r.isManual) return false;
      if (filter === "missing" && !r.isMissing) return false;
      if (filter === "outdated" && !r.isOutdated) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.key.toLowerCase().includes(q) ||
        r.sv.toLowerCase().includes(q) ||
        r.ai.toLowerCase().includes(q) ||
        r.manual.toLowerCase().includes(q)
      );
    });

  const counts = {
    all: allKeys.length,
    manual: allKeys.filter((k) => overrides[k]).length,
    outdated: allKeys.filter(
      (k) => overrides[k] && overrides[k].source_text_at_override !== (svFlat[k] ?? ""),
    ).length,
    missing: allKeys.filter((k) => !enFlat[k] && !overrides[k]).length,
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-2xl font-semibold mb-1">Översättningar (engelska)</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Manuella översättningar har alltid företräde över AI-översättningar och loggas i audit-historiken.
      </p>

      {counts.outdated > 0 && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <strong>{counts.outdated}</strong> manuella översättningar kan vara inaktuella — svensk källtext har ändrats sedan översättningen låstes.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Input
          placeholder="Sök nyckel eller text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">Alla ({counts.all})</TabsTrigger>
            <TabsTrigger value="manual">Manuella ({counts.manual})</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="outdated">Inaktuella ({counts.outdated})</TabsTrigger>
            <TabsTrigger value="missing">Saknas ({counts.missing})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2 w-1/5">Nyckel</th>
              <th className="text-left p-2 w-1/4">Svenska</th>
              <th className="text-left p-2 w-1/4">Engelska (aktiv)</th>
              <th className="text-left p-2 w-32">Status</th>
              <th className="p-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t hover:bg-muted/20">
                <td className="p-2 font-mono text-[11px] align-top">{r.key}</td>
                <td className="p-2 align-top">{r.sv}</td>
                <td className="p-2 align-top">
                  {r.isManual ? r.manual : r.ai || <em className="text-muted-foreground">(saknas)</em>}
                </td>
                <td className="p-2 align-top">
                  {r.isManual && (
                    <Badge className="bg-amber-400 text-zinc-900 hover:bg-amber-400">Manuell</Badge>
                  )}
                  {r.isOutdated && (
                    <Badge variant="destructive" className="ml-1">Inaktuell</Badge>
                  )}
                  {!r.isManual && r.ai && <Badge variant="outline">AI</Badge>}
                  {r.isMissing && <Badge variant="outline">Saknas</Badge>}
                </td>
                <td className="p-2 align-top text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditKey(r.key)} aria-label="Redigera">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {r.isManual && (
                    <Button size="icon" variant="ghost" onClick={() => setHistoryKey(r.key)} aria-label="Historik">
                      <History className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Inga nycklar matchar filtret.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editKey && (
        <TranslationEditPopover
          translationKey={editKey}
          onClose={() => {
            setEditKey(null);
            void loadOverrides();
          }}
        />
      )}

      <Dialog open={!!historyKey} onOpenChange={(o) => !o && setHistoryKey(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historik: <span className="font-mono text-sm">{historyKey}</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {history.length === 0 && <p className="text-sm text-muted-foreground">Ingen historik.</p>}
            {history.map((h, i) => (
              <div key={i} className="border rounded-md p-2 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <Badge variant="outline">{h.action}</Badge>
                  <span>{new Date(h.changed_at).toLocaleString("sv-SE")}</span>
                </div>
                {h.old_value !== null && (
                  <div><span className="text-muted-foreground text-xs">Innan:</span> <span className="line-through">{h.old_value}</span></div>
                )}
                {h.new_value !== null && (
                  <div><span className="text-muted-foreground text-xs">Efter:</span> {h.new_value}</div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
