import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Copy, Trash2, Check, Loader2, RefreshCw, X } from "lucide-react";
import {
  Insight, InsightStatus, InsightPriority,
  STATUS_LABEL, PRIORITY_LABEL, SOURCE_LABEL,
} from "./types";

interface Props {
  insight: Insight;
  related: Insight[];
  onChanged: () => void;
  onClose: () => void;
}

type AiMode = "summary" | "actions" | "brief";

const NOTE_FIELD: Record<AiMode, "summary_notes" | "actions_notes" | "brief_notes"> = {
  summary: "summary_notes",
  actions: "actions_notes",
  brief: "brief_notes",
};

export function InsightDetail({ insight, related, onChanged, onClose }: Props) {
  const [notes, setNotes] = useState(insight.my_notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [implRef, setImplRef] = useState(insight.implementation_ref ?? "");

  // Per-mode comments (admin overrides)
  const [summaryNotes, setSummaryNotes] = useState(insight.summary_notes ?? "");
  const [actionsNotes, setActionsNotes] = useState(insight.actions_notes ?? "");
  const [briefNotes, setBriefNotes] = useState(insight.brief_notes ?? "");
  const [savingMode, setSavingMode] = useState<AiMode | null>(null);

  const update = async (patch: Partial<Insight>) => {
    const { error } = await supabase.from("admin_insights").update(patch).eq("id", insight.id);
    if (error) {
      toast({ title: "Kunde inte uppdatera", description: error.message, variant: "destructive" });
      return false;
    }
    onChanged();
    return true;
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await update({ my_notes: notes });
    setSavingNotes(false);
    toast({ title: "Anteckningar sparade" });
  };

  const setStatus = async (status: InsightStatus) => {
    const patch: Partial<Insight> = { status };
    if (status === "implemented" && !insight.implemented_at) {
      patch.implemented_at = new Date().toISOString();
    }
    await update(patch);
  };

  const callAi = async (mode: AiMode) => {
    // Persist any pending mode-notes before calling so the backend reads the latest
    const pending: Partial<Insight> = {};
    if (mode === "summary" && summaryNotes !== insight.summary_notes) pending.summary_notes = summaryNotes;
    if (mode === "actions" && actionsNotes !== insight.actions_notes) pending.actions_notes = actionsNotes;
    if (mode === "brief" && briefNotes !== insight.brief_notes) pending.brief_notes = briefNotes;
    if (Object.keys(pending).length > 0) {
      const ok = await update(pending);
      if (!ok) return;
    }

    setAiBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insight-brief", {
        body: { insight_id: insight.id, mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "AI klar" });
      onChanged();
    } catch (e) {
      toast({ title: "AI-fel", description: e instanceof Error ? e.message : "Okänt", variant: "destructive" });
    } finally {
      setAiBusy(null);
    }
  };

  const saveModeNotes = async (mode: AiMode) => {
    setSavingMode(mode);
    const value =
      mode === "summary" ? summaryNotes :
      mode === "actions" ? actionsNotes :
      briefNotes;
    await update({ [NOTE_FIELD[mode]]: value } as Partial<Insight>);
    setSavingMode(null);
    toast({ title: "Kommentar sparad" });
  };

  const copyBrief = async () => {
    if (!insight.ai_brief) return;
    await navigator.clipboard.writeText(insight.ai_brief);
    toast({ title: "Brief kopierad", description: "Klistra in i Lovable-chatten." });
  };

  const handleDelete = async () => {
    if (!confirm("Radera insikten permanent?")) return;
    const { error } = await supabase.from("admin_insights").delete().eq("id", insight.id);
    if (error) {
      toast({ title: "Kunde inte radera", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Raderad" });
    onChanged();
    onClose();
  };

  const discardAi = async (mode: AiMode) => {
    if (!confirm(
      mode === "summary" ? "Slänga AI-sammanfattningen permanent?" :
      mode === "actions" ? "Slänga AI:s åtgärdsförslag permanent?" :
      "Slänga Lovable-briefen permanent?"
    )) return;
    const field =
      mode === "summary" ? { ai_summary: null } :
      mode === "actions" ? { ai_proposed_actions: null } :
      { ai_brief: null };
    await update(field as Partial<Insight>);
    toast({ title: "Slängd" });
  };

  const renderModeBlock = (
    mode: AiMode,
    label: string,
    aiText: string | null,
    notesValue: string,
    setNotesValue: (v: string) => void,
    savedValue: string,
    extraHeader?: React.ReactNode,
  ) => {
    if (!aiText) return null;
    const dirty = notesValue !== savedValue;
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
          <div className="flex items-center gap-1">
            {extraHeader}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => discardAi(mode)}
              className="h-7 rounded-full text-[12px] gap-1.5 text-muted-foreground hover:text-destructive"
              title="Släng och radera permanent"
            >
              <X className="h-3.5 w-3.5" /> Släng
            </Button>
          </div>
        </div>
        <div className={`p-3 rounded-lg bg-surface-2 text-[14px] whitespace-pre-wrap ${mode === "brief" ? "font-mono text-[13px]" : ""}`}>
          {aiText}
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Mina kommentarer · överordnar AI vid omgenerering
            </Label>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveModeNotes(mode)}
                disabled={savingMode === mode || !dirty}
                className="h-7 rounded-full text-[12px]"
              >
                {savingMode === mode ? "Sparar…" : dirty ? "Spara" : "Sparat"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => callAi(mode)}
                disabled={!!aiBusy}
                className="h-7 rounded-full text-[12px] gap-1.5"
              >
                {aiBusy === mode ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Generera om
              </Button>
            </div>
          </div>
          <Textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            rows={3}
            placeholder="T.ex. 'Fokusera på mobil', 'Skriv kortare', 'Strunta i acceptanskriterier'…"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {insight.raw_text.slice(0, 80)}{insight.raw_text.length > 80 ? "…" : ""}
          </h3>
          <p className="text-[12px] text-muted-foreground mt-1">
            {SOURCE_LABEL[insight.source]}
            {insight.source_label ? ` · ${insight.source_label}` : ""}
            {" · "}{new Date(insight.created_at).toLocaleDateString("sv-SE")}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="rounded-full text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</Label>
          <Select value={insight.status} onValueChange={(v) => setStatus(v as InsightStatus)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABEL) as InsightStatus[]).map((k) => (
                <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Prioritet</Label>
          <Select value={insight.priority} onValueChange={(v) => update({ priority: v as InsightPriority })}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_LABEL) as InsightPriority[]).map((k) => (
                <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Tema</Label>
          <Input
            value={insight.theme ?? ""}
            onChange={(e) => update({ theme: e.target.value || null })}
            placeholder="Editor, Presentation…"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Råtext</Label>
        <div className="mt-1.5 p-3 rounded-lg bg-surface-2 text-[14px] whitespace-pre-wrap">
          {insight.raw_text}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Mina anteckningar</Label>
          <Button size="sm" variant="ghost" onClick={saveNotes} disabled={savingNotes || notes === insight.my_notes} className="h-7 rounded-full text-[12px]">
            {savingNotes ? "Sparar…" : notes === insight.my_notes ? "Sparat" : "Spara"}
          </Button>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Allt du tänker, beslutar, testar…"
        />
      </div>

      {related.length > 0 && (
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Relaterade insikter ({related.length})</Label>
          <ul className="mt-1.5 space-y-1.5">
            {related.map((r) => (
              <li key={r.id} className="text-[13px] text-muted-foreground">
                • "{r.raw_text.slice(0, 100)}{r.raw_text.length > 100 ? "…" : ""}"
                {r.source_label ? ` — ${r.source_label}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t-hair pt-5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">AI-verktyg</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={() => callAi("summary")} disabled={!!aiBusy} className="rounded-full text-[12px] h-8 gap-1.5">
            {aiBusy === "summary" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Sammanfatta
          </Button>
          <Button size="sm" variant="outline" onClick={() => callAi("actions")} disabled={!!aiBusy} className="rounded-full text-[12px] h-8 gap-1.5">
            {aiBusy === "actions" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Föreslå åtgärder
          </Button>
          <Button size="sm" onClick={() => callAi("brief")} disabled={!!aiBusy} className="rounded-full text-[12px] h-8 gap-1.5 bg-accent-blue hover:bg-accent-blue/90 text-white">
            {aiBusy === "brief" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Skriv Lovable-brief
          </Button>
        </div>

        {renderModeBlock("summary", "AI-sammanfattning", insight.ai_summary, summaryNotes, setSummaryNotes, insight.summary_notes ?? "")}
        {renderModeBlock("actions", "Föreslagna åtgärder", insight.ai_proposed_actions, actionsNotes, setActionsNotes, insight.actions_notes ?? "")}
        {renderModeBlock(
          "brief",
          "Lovable-brief",
          insight.ai_brief,
          briefNotes,
          setBriefNotes,
          insight.brief_notes ?? "",
          <Button size="sm" variant="ghost" onClick={copyBrief} className="h-7 rounded-full text-[12px] gap-1.5">
            <Copy className="h-3 w-3" /> Kopiera
          </Button>,
        )}
      </div>

      {insight.status === "implemented" && (
        <div className="border-t-hair pt-5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Implementations-referens</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={implRef}
              onChange={(e) => setImplRef(e.target.value)}
              placeholder="Commit, version eller anteckning"
            />
            <Button size="sm" variant="outline" onClick={() => update({ implementation_ref: implRef || null })} className="rounded-full">
              <Check className="h-4 w-4" />
            </Button>
          </div>
          {insight.implemented_at && (
            <p className="text-[12px] text-muted-foreground mt-1.5">
              Markerad som implementerad {new Date(insight.implemented_at).toLocaleString("sv-SE")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
