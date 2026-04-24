import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ThemeCombobox } from "./ThemeCombobox";
import { SOURCE_LABEL, PRIORITY_LABEL, type InsightSource, type InsightPriority } from "./types";

export interface NewInsightPrefill {
  raw_text?: string;
  source?: InsightSource;
  source_label?: string;
  linked_user_id?: string | null;
  linked_thread_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  themes?: string[];
  prefill?: NewInsightPrefill | null;
}

export function NewInsightDialog({ open, onOpenChange, onCreated, themes = [], prefill }: Props) {
  const { user } = useAuth();
  const [rawText, setRawText] = useState("");
  const [source, setSource] = useState<InsightSource>("email");
  const [sourceLabel, setSourceLabel] = useState("");
  const [theme, setTheme] = useState("");
  const [priority, setPriority] = useState<InsightPriority>("medium");
  const [saving, setSaving] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [linkedThreadId, setLinkedThreadId] = useState<string | null>(null);

  const reset = () => {
    setRawText("");
    setSource("email");
    setSourceLabel("");
    setTheme("");
    setPriority("medium");
    setLinkedUserId(null);
    setLinkedThreadId(null);
  };

  // Apply prefill when opening
  useEffect(() => {
    if (open && prefill) {
      setRawText(prefill.raw_text ?? "");
      setSource(prefill.source ?? "email");
      setSourceLabel(prefill.source_label ?? "");
      setLinkedUserId(prefill.linked_user_id ?? null);
      setLinkedThreadId(prefill.linked_thread_id ?? null);
    }
  }, [open, prefill]);

  const handleSave = async () => {
    if (!rawText.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from("admin_insights").insert({
      user_id: user.id,
      raw_text: rawText.trim(),
      source,
      source_label: sourceLabel.trim() || null,
      theme: theme.trim() || null,
      priority,
      linked_user_id: linkedUserId,
      linked_thread_id: linkedThreadId,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Insikt sparad" });
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Ny insikt</DialogTitle>
          <DialogDescription>
            {prefill?.linked_user_id
              ? "Insikten kopplas automatiskt till användaren och feedback-tråden."
              : "Logga en synpunkt på 15 sekunder. Detaljer kan fyllas i senare."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="raw">Synpunkt / råtext</Label>
            <Textarea
              id="raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Vad sa de? Skriv så som du hörde det…"
              rows={4}
              className="mt-1.5"
              autoFocus
            />
          </div>
          {linkedUserId && (
            <div className="text-[12px] text-muted-foreground bg-accent-blue/5 px-3 py-2 rounded-lg border border-accent-blue/20">
              Kopplad till användare {sourceLabel || "(okänd)"}
              {linkedThreadId && " · feedback-tråd"}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Källa</Label>
              <Select value={source} onValueChange={(v) => setSource(v as InsightSource)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABEL) as InsightSource[]).map((k) => (
                    <SelectItem key={k} value={k}>{SOURCE_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as InsightPriority)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as InsightPriority[]).map((k) => (
                    <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="srcLabel">Vem / var (valfritt)</Label>
              <Input id="srcLabel" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Karin" className="mt-1.5" />
            </div>
            <div>
              <Label>Tema (valfritt)</Label>
              <div className="mt-1.5">
                <ThemeCombobox value={theme} onChange={setTheme} themes={themes} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Avbryt</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !rawText.trim()}
            className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white"
          >
            {saving ? "Sparar…" : "Spara insikt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
