import { useState } from "react";
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
import { SOURCE_LABEL, PRIORITY_LABEL, type InsightSource, type InsightPriority } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}

export function NewInsightDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [rawText, setRawText] = useState("");
  const [source, setSource] = useState<InsightSource>("email");
  const [sourceLabel, setSourceLabel] = useState("");
  const [theme, setTheme] = useState("");
  const [priority, setPriority] = useState<InsightPriority>("medium");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setRawText("");
    setSource("email");
    setSourceLabel("");
    setTheme("");
    setPriority("medium");
  };

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
          <DialogDescription>Logga en synpunkt på 15 sekunder. Detaljer kan fyllas i senare.</DialogDescription>
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
              <Label htmlFor="theme">Tema (valfritt)</Label>
              <Input id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Editor" className="mt-1.5" />
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
