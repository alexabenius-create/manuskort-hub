import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Loader2, X, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { NewInsightDialog } from "./NewInsightDialog";
import { InsightDetail } from "./InsightDetail";
import {
  Insight, InsightStatus, STATUS_LABEL, PRIORITY_LABEL, SOURCE_LABEL,
} from "./types";

const STATUS_FILTERS: Array<{ key: "all" | InsightStatus; label: string }> = [
  { key: "all", label: "Alla" },
  { key: "new", label: STATUS_LABEL.new },
  { key: "processing", label: STATUS_LABEL.processing },
  { key: "ready", label: STATUS_LABEL.ready },
  { key: "implemented", label: STATUS_LABEL.implemented },
  { key: "archived", label: STATUS_LABEL.archived },
];

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} min sedan`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} h sedan`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} d sedan`;
  return new Date(iso).toLocaleDateString("sv-SE");
}

export function InsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | InsightStatus>("all");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [dupBusy, setDupBusy] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_insights")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Kunde inte ladda insikter", description: error.message, variant: "destructive" });
      setInsights([]);
    } else {
      setInsights((data ?? []) as Insight[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const themes = useMemo(() => {
    const counts = new Map<string, number>();
    insights.forEach((i) => {
      if (i.theme) counts.set(i.theme, (counts.get(i.theme) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [insights]);

  const filtered = useMemo(() => {
    return insights.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (themeFilter && i.theme !== themeFilter) return false;
      return true;
    });
  }, [insights, filter, themeFilter]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: insights.length };
    insights.forEach((i) => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [insights]);

  const selected = useMemo(() => insights.find((i) => i.id === selectedId) ?? null, [insights, selectedId]);
  const related = useMemo(() => {
    if (!selected) return [];
    return insights.filter((i) => selected.related_ids.includes(i.id));
  }, [insights, selected]);

  const findDuplicates = async () => {
    setDupBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insight-brief", {
        body: { mode: "duplicates" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Dubblettanalys klar",
        description: data.text?.slice(0, 200) ?? "Inga grupper hittade.",
      });
    } catch (e) {
      toast({ title: "AI-fel", description: e instanceof Error ? e.message : "Okänt", variant: "destructive" });
    } finally {
      setDupBusy(false);
    }
  };

  const priorityDot = (p: string) =>
    p === "high" ? "bg-[hsl(var(--cue-red))]" :
    p === "medium" ? "bg-[hsl(var(--cue-amber))]" :
    "bg-muted-foreground/40";

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Insikter</h2>
          <p className="text-muted-foreground text-[15px] mt-2">
            Logga synpunkter, bearbeta dem, generera färdiga åtgärds-briefs att klistra in här i chatten.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={findDuplicates}
            disabled={dupBusy || insights.length < 2}
            className="rounded-full gap-1.5 h-9"
          >
            {dupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Hitta dubbletter
          </Button>
          <Button
            size="sm"
            onClick={() => setNewOpen(true)}
            className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5 h-9"
          >
            <Plus className="h-3.5 w-3.5" /> Ny insikt
          </Button>
        </div>
      </div>

      {(() => {
        // Compute responsive column widths based on what's collapsed
        const filtersCol = filtersCollapsed ? "w-12 shrink-0" : "w-[220px] shrink-0";
        const listCol = !selected
          ? "flex-1"
          : listCollapsed
            ? "w-12 shrink-0"
            : "w-[340px] shrink-0";
        const detailCol = "flex-1 min-w-0";

        return (
          <div className="flex gap-4 items-start">
            {/* Sidebar filters */}
            <aside className={filtersCol}>
              {filtersCollapsed ? (
                <div className="bg-surface rounded-2xl shadow-card p-2 flex flex-col items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltersCollapsed(false)}
                    className="h-8 w-8 p-0 rounded-full"
                    title="Visa filter"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="bg-surface rounded-2xl shadow-card p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Filter</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiltersCollapsed(true)}
                      className="h-7 w-7 p-0 rounded-full"
                      title="Dölj filter"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Status</p>
                    <div className="space-y-1">
                      {STATUS_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setFilter(f.key)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] flex items-center justify-between ${
                            filter === f.key ? "bg-accent-blue/10 text-accent-blue font-medium" : "hover:bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          <span>{f.label}</span>
                          <span className="text-[11px] tabular-nums">{statusCounts[f.key] ?? 0}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {themes.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Tema</p>
                      <div className="space-y-1">
                        <button
                          onClick={() => setThemeFilter(null)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] ${
                            themeFilter === null ? "bg-surface-2 text-foreground font-medium" : "hover:bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          Alla teman
                        </button>
                        {themes.map(([t, c]) => (
                          <button
                            key={t}
                            onClick={() => setThemeFilter(t)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] flex items-center justify-between ${
                              themeFilter === t ? "bg-accent-blue/10 text-accent-blue font-medium" : "hover:bg-surface-2 text-muted-foreground"
                            }`}
                          >
                            <span>{t}</span>
                            <span className="text-[11px] tabular-nums">{c}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>

            {/* List */}
            <section className={listCol}>
              {selected && listCollapsed ? (
                <div className="bg-surface rounded-2xl shadow-card p-2 flex flex-col items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setListCollapsed(false)}
                    className="h-8 w-8 p-0 rounded-full"
                    title="Visa lista"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
                  {selected && (
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                        {filtered.length} insikter
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setListCollapsed(true)}
                        className="h-7 w-7 p-0 rounded-full"
                        title="Dölj lista"
                      >
                        <PanelLeftClose className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {loading ? (
                    <p className="text-center text-muted-foreground py-16">Laddar…</p>
                  ) : filtered.length === 0 ? (
                    <p className="text-center text-muted-foreground py-16">
                      {insights.length === 0 ? "Inga insikter än. Klicka på 'Ny insikt' för att börja." : "Inga insikter matchar filtret."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border max-h-[calc(100vh-220px)] overflow-y-auto">
                      {filtered.map((i) => (
                        <li key={i.id}>
                          <button
                            onClick={() => setSelectedId(i.id)}
                            className={`w-full text-left p-4 hover:bg-surface-2/40 transition-colors ${
                              selectedId === i.id ? "bg-surface-2/60" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`h-2 w-2 rounded-full ${priorityDot(i.priority)}`} />
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                                {PRIORITY_LABEL[i.priority]}
                              </span>
                              {i.theme && (
                                <span className="text-[11px] text-muted-foreground">· {i.theme}</span>
                              )}
                              <span className="ml-auto text-[11px] text-muted-foreground">{formatRelative(i.created_at)}</span>
                            </div>
                            <p className="text-[14px] line-clamp-2">
                              {i.raw_text}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                              {SOURCE_LABEL[i.source]}{i.source_label ? ` · ${i.source_label}` : ""}
                              {" · "}{STATUS_LABEL[i.status]}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Detail */}
            {selected && (
              <section className={detailCol}>
                <div className="bg-surface rounded-2xl shadow-card p-6">
                  <div className="flex justify-end gap-1 mb-2">
                    {!listCollapsed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFiltersCollapsed(true);
                          setListCollapsed(true);
                        }}
                        className="h-7 rounded-full text-[12px] gap-1.5 px-2.5"
                        title="Maximera arbetsyta"
                      >
                        <PanelRightOpen className="h-3.5 w-3.5" /> Maximera
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="h-7 w-7 p-0 rounded-full">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <InsightDetail
                    key={selected.id}
                    insight={selected}
                    related={related}
                    onChanged={load}
                    onClose={() => setSelectedId(null)}
                  />
                </div>
              </section>
            )}
          </div>
        );
      })()}

      <NewInsightDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
    </>
  );
}
