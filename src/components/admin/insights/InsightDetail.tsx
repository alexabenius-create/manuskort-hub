import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Check, Send, User as UserIcon, X } from "lucide-react";
import {
  Insight, InsightStatus, InsightPriority,
  STATUS_LABEL, PRIORITY_LABEL, SOURCE_LABEL,
} from "./types";
import { ThemeCombobox } from "./ThemeCombobox";
import { SendFeedbackDialog } from "./SendFeedbackDialog";

interface UserOption {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface Props {
  insight: Insight;
  related: Insight[];
  themes: string[];
  onChanged: () => void;
  onClose: () => void;
}

export function InsightDetail({ insight, related, themes, onChanged, onClose }: Props) {
  const [notes, setNotes] = useState(insight.my_notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [implRef, setImplRef] = useState(insight.implementation_ref ?? "");

  const [actions, setActions] = useState(insight.actions_notes ?? "");
  const [savingActions, setSavingActions] = useState(false);

  const [linkedUser, setLinkedUser] = useState<UserOption | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Sync local state when switching insight
  useEffect(() => {
    setNotes(insight.my_notes);
    setActions(insight.actions_notes ?? "");
    setImplRef(insight.implementation_ref ?? "");
  }, [insight.id]);

  // Hämta info om kopplad användare via admin_list_users (RLS hindrar direkt access till profiles)
  useEffect(() => {
    if (!insight.linked_user_id) {
      setLinkedUser(null);
      return;
    }
    // Om vi redan har laddat användarlistan, hitta där
    const fromList = users.find((u) => u.user_id === insight.linked_user_id);
    if (fromList) {
      setLinkedUser(fromList);
      return;
    }
    // Annars hämta listan en gång
    supabase.rpc("admin_list_users").then(({ data }) => {
      if (!data) return;
      const list = (data as Array<{ user_id: string; email: string | null; display_name: string | null }>).map((u) => ({
        user_id: u.user_id,
        email: u.email,
        display_name: u.display_name,
      }));
      setUsers(list);
      const found = list.find((u) => u.user_id === insight.linked_user_id);
      if (found) setLinkedUser(found);
    });
  }, [insight.linked_user_id, users]);

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

  const openUserPicker = async () => {
    setShowUserPicker(true);
    if (users.length === 0) {
      setLoadingUsers(true);
      const { data } = await supabase.rpc("admin_list_users");
      if (data) {
        setUsers(
          (data as Array<{ user_id: string; email: string | null; display_name: string | null }>).map((u) => ({
            user_id: u.user_id,
            email: u.email,
            display_name: u.display_name,
          })),
        );
      }
      setLoadingUsers(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.display_name ?? "").toLowerCase().includes(q)
    );
  });

  const linkUser = async (u: UserOption) => {
    await update({ linked_user_id: u.user_id });
    setLinkedUser(u);
    setShowUserPicker(false);
    setUserQuery("");
    toast({ title: "Användare kopplad" });
  };

  const unlinkUser = async () => {
    await update({ linked_user_id: null, linked_thread_id: null });
    setLinkedUser(null);
    toast({ title: "Koppling borttagen" });
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

      {/* Kopplad användare */}
      <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {linkedUser ? (
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">
                  {linkedUser.display_name || linkedUser.email || "(okänd)"}
                </p>
                {linkedUser.display_name && linkedUser.email && (
                  <p className="text-[11px] text-muted-foreground truncate">{linkedUser.email}</p>
                )}
              </div>
            ) : (
              <span className="text-[13px] text-muted-foreground">Inte kopplad till en användare</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {linkedUser && (
              <Button variant="ghost" size="sm" onClick={unlinkUser} className="h-7 rounded-full text-[12px] text-muted-foreground">
                <X className="h-3 w-3" /> Ta bort
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openUserPicker} className="h-7 rounded-full text-[12px]">
              {linkedUser ? "Byt" : "Koppla användare"}
            </Button>
          </div>
        </div>

        {showUserPicker && (
          <div className="mt-3 border-t border-border pt-3">
            <Input
              autoFocus
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Sök på e-post eller namn…"
              className="h-9 text-[13px] mb-2"
            />
            <div className="max-h-[200px] overflow-y-auto space-y-0.5">
              {loadingUsers ? (
                <p className="text-[12px] text-muted-foreground py-2 text-center">Laddar…</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-[12px] text-muted-foreground py-2 text-center">Inga träffar.</p>
              ) : (
                filteredUsers.slice(0, 30).map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => linkUser(u)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-[13px] hover:bg-surface-2"
                  >
                    <span className="font-medium">{u.display_name || u.email || "(okänd)"}</span>
                    {u.display_name && u.email && (
                      <span className="text-muted-foreground"> · {u.email}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
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
          <div className="mt-1.5">
            <ThemeCombobox
              value={insight.theme ?? ""}
              onChange={(v) => update({ theme: v || null })}
              themes={themes}
            />
          </div>
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
        <div className="border-t-hair pt-5 space-y-4">
          {/* Skicka återkoppling */}
          {insight.linked_user_id && (
            <div className="rounded-xl bg-accent-blue/5 border border-accent-blue/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[14px] font-medium">Återkoppla till användaren</p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {insight.feedback_sent_at
                      ? `Skickad ${new Date(insight.feedback_sent_at).toLocaleString("sv-SE")}. Du kan skicka igen om något ska kompletteras.`
                      : "Skicka ett trevligt meddelande till användaren om att deras feedback nu är implementerad."}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setFeedbackOpen(true)}
                  className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  {insight.feedback_sent_at ? "Skicka igen" : "Skicka återkoppling"}
                </Button>
              </div>
            </div>
          )}

          <div>
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
        </div>
      )}

      <SendFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        insight={insight}
        onSent={onChanged}
      />
    </div>
  );
}
