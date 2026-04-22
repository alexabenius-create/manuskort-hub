import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ShareRequest } from "@/hooks/useShareRequests";

interface ManuscriptOption {
  id: string;
  title: string;
  updated_at: string;
}

/**
 * Visas i tråd-vyn på /meddelanden när admin har skapat en delningsbegäran.
 * Användaren kan välja ett manus att dela, avslå, eller (om granted) återkalla.
 */
export function ShareRequestCard({ request }: { request: ShareRequest }) {
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manuscripts, setManuscripts] = useState<ManuscriptOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [working, setWorking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!pickerOpen || !user) return;
    setLoadingList(true);
    supabase
      .from("manuscripts")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setManuscripts((data ?? []) as ManuscriptOption[]);
        setLoadingList(false);
      });
  }, [pickerOpen, user]);

  const grant = async () => {
    if (!selectedId) return;
    setWorking(true);
    const { error } = await supabase
      .from("manuscript_share_requests")
      .update({
        status: "granted",
        manuscript_id: selectedId,
        granted_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    setWorking(false);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    setPickerOpen(false);
    toast({ title: "Delning aktiv", description: "Admin kan nu redigera det valda manuset." });
  };

  const deny = async () => {
    setWorking(true);
    const { error } = await supabase
      .from("manuscript_share_requests")
      .update({ status: "denied" })
      .eq("id", request.id);
    setWorking(false);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Begäran avslagen" });
  };

  const revoke = async () => {
    setWorking(true);
    const { error } = await supabase
      .from("manuscript_share_requests")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", request.id);
    setWorking(false);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Delning avslutad", description: "Admin har inte längre tillgång." });
  };

  if (request.status === "denied") {
    return (
      <div className="rounded-2xl border border-border/40 bg-surface-2/40 px-4 py-3 text-[13px] text-muted-foreground italic">
        Du avslog en delningsbegäran från admin.
      </div>
    );
  }

  if (request.status === "revoked") {
    return (
      <div className="rounded-2xl border border-border/40 bg-surface-2/40 px-4 py-3 text-[13px] text-muted-foreground italic">
        Delningen är avslutad. Admin har inte längre tillgång.
      </div>
    );
  }

  if (request.status === "granted") {
    return (
      <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground mb-1">
              Admin kan just nu redigera ett av dina manus
            </p>
            <p className="text-[12px] text-muted-foreground mb-3">
              Tillgången gäller tills du avslutar delningen.
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={revoke}
              disabled={working}
              className="rounded-full text-[12px] h-8 gap-1"
            >
              <X className="h-3 w-3" />
              Sluta dela mitt manuskort med Admin
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // pending
  return (
    <>
      <div className="rounded-2xl border-2 border-accent-blue/30 bg-accent-blue/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-accent-blue flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground mb-1">
              Admin ber om tillåtelse att redigera ett av dina manus
            </p>
            <p className="text-[12px] text-muted-foreground mb-3">
              Du väljer själv vilket manus som delas. Du kan när som helst återkalla tillgången.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={working}
                className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white text-[12px] h-8"
              >
                Välj manus att dela
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={deny}
                disabled={working}
                className="rounded-full text-[12px] h-8 text-muted-foreground"
              >
                Avslå
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Välj manus att dela</DialogTitle>
            <DialogDescription>
              Admin får läsa och redigera det valda manuset tills du avslutar delningen.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto -mx-2 px-2">
            {loadingList ? (
              <p className="text-center text-muted-foreground py-8 text-[13px]">Laddar…</p>
            ) : manuscripts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-[13px]">Du har inga manus.</p>
            ) : (
              <ul className="space-y-1">
                {manuscripts.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-[14px] transition-colors ${
                        selectedId === m.id
                          ? "bg-accent-blue/10 ring-1 ring-accent-blue/40"
                          : "hover:bg-surface-2"
                      }`}
                    >
                      <div className="font-medium truncate">{m.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(m.updated_at).toLocaleDateString("sv-SE")}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)} className="rounded-full">
              Avbryt
            </Button>
            <Button
              onClick={grant}
              disabled={working || !selectedId}
              className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white"
            >
              {working ? "Delar…" : "Bekräfta delning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
