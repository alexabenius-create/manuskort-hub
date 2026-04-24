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
import { Trash2, Check } from "lucide-react";
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

export function InsightDetail({ insight, related, onChanged, onClose }: Props) {
  const [notes, setNotes] = useState(insight.my_notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [implRef, setImplRef] = useState(insight.implementation_ref ?? "");

  // Förslag på åtgärder (återanvänder actions_notes-fältet)
  const [actions, setActions] = useState(insight.actions_notes ?? "");
  const [savingActions, setSavingActions] = useState(false);

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

  const saveActions = async () => {
    setSavingActions(true);
    await update({ actions_notes: actions });
    setSavingActions(false);
    toast({ title: "Förslag sparade" });
  };

  const setStatus = async (status: InsightStatus) => {
    const patch: Partial<Insight> = { status };
    if (status === "implemented" && !insight.implemented_at) {
      patch.implemented_at = new Date().toISOString();
    }
    await update(patch);
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

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Förslag på åtgärder</Label>
          <Button size="sm" variant="ghost" onClick={saveActions} disabled={savingActions || actions === (insight.actions_notes ?? "")} className="h-7 rounded-full text-[12px]">
            {savingActions ? "Sparar…" : actions === (insight.actions_notes ?? "") ? "Sparat" : "Spara"}
          </Button>
        </div>
        <Textarea
          value={actions}
          onChange={(e) => setActions(e.target.value)}
          rows={6}
          placeholder="Konkreta åtgärder, idéer, lösningar att testa…"
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
