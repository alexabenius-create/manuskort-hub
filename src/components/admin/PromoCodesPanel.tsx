import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Users, Loader2, Link2 } from "lucide-react";

interface PromoCode {
  id: string;
  code: string;
  description: string;
  mode: "rolling" | "fixed";
  duration_days: number | null;
  fixed_starts_at: string | null;
  fixed_ends_at: string | null;
  usage_type: "unique" | "shared";
  max_redemptions: number | null;
  redemption_count: number;
  active: boolean;
  created_at: string;
}

interface Redemption {
  user_id: string;
  email: string | null;
  redeemed_at: string;
  expires_at: string;
}

function genCode(len = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function PromoCodesPanel() {
  const [rows, setRows] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [redOpen, setRedOpen] = useState<PromoCode | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_promo_codes");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as PromoCode[]);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (row: PromoCode) => {
    const { error } = await supabase.rpc("admin_set_promo_active", { _id: row.id, _active: !row.active });
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (row: PromoCode) => {
    if (!confirm(`Radera koden ${row.code}? Inlösningar tas bort men användarnas pågående PRO-period upphör.`)) return;
    const { error } = await supabase.rpc("admin_delete_promo_code", { _id: row.id });
    if (error) return toast.error(error.message);
    toast.success("Koden raderad");
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Kopierade ${code}`);
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/promo/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Länk kopierad");
  };

  const expiresLabel = (r: PromoCode) => {
    if (r.mode === "fixed" && r.fixed_ends_at) {
      return new Date(r.fixed_ends_at).toLocaleDateString("sv-SE");
    }
    return `${r.duration_days} dagar (rullande)`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">Kampanjkoder</h2>
          <p className="text-v2-muted text-[15px] mt-2">
            Skapa tidsbegränsade PRO-koder för nya eller befintliga användare.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-1.5">
          <Plus className="h-4 w-4" /> Skapa kod
        </Button>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-center text-v2-muted py-16">Laddar koder…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-v2-muted py-16">Inga kampanjkoder skapade än.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-v2-line">
                <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium">Kod</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium">Beskrivning</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium">Period</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium">Typ</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium text-right">Inlösta</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium">Aktiv</TableHead>
                <TableHead className="text-right text-[12px] uppercase tracking-wide text-v2-muted font-medium">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-b border-v2-line hover:bg-v2-violet/5">
                  <TableCell className="font-mono text-[13px] text-v2-ink">
                    <button onClick={() => copy(r.code)} className="inline-flex items-center gap-1.5 hover:text-v2-violet">
                      {r.code}
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  </TableCell>
                  <TableCell className="text-[13px] text-v2-muted max-w-[240px] truncate">{r.description || "—"}</TableCell>
                  <TableCell className="text-[13px] text-v2-ink">{expiresLabel(r)}</TableCell>
                  <TableCell className="text-[13px] text-v2-muted">
                    {r.usage_type === "unique" ? "Unik" : `Delad${r.max_redemptions ? ` (max ${r.max_redemptions})` : ""}`}
                  </TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums">
                    <button onClick={() => setRedOpen(r)} className="inline-flex items-center gap-1.5 hover:text-v2-violet">
                      {r.redemption_count}
                      <Users className="h-3 w-3 opacity-50" />
                    </button>
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => copyLink(r.code)} title="Kopiera inlösningslänk" className="text-v2-muted hover:text-v2-violet">
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(r)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <NewPromoDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <RedemptionsDialog promo={redOpen} onOpenChange={(o) => !o && setRedOpen(null)} />
    </div>
  );
}

function NewPromoDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"rolling" | "fixed">("rolling");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");
  const [usageType, setUsageType] = useState<"unique" | "shared">("shared");
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCode(""); setDescription(""); setMode("rolling");
    setDurationDays(30); setStartsAt(""); setEndsAt("");
    setUsageType("shared"); setMaxRedemptions("");
  };

  const submit = async () => {
    const finalCode = code.trim() || genCode();
    if (mode === "rolling" && (!durationDays || durationDays < 1)) {
      return toast.error("Antal dagar måste vara minst 1");
    }
    if (mode === "fixed" && !endsAt) {
      return toast.error("Ange ett slutdatum");
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_create_promo_code", {
      _code: finalCode,
      _description: description,
      _mode: mode,
      _duration_days: mode === "rolling" ? durationDays : null,
      _fixed_starts_at: mode === "fixed" && startsAt ? new Date(startsAt).toISOString() : null,
      _fixed_ends_at: mode === "fixed" && endsAt ? new Date(endsAt).toISOString() : null,
      _usage_type: usageType,
      _max_redemptions: usageType === "shared" && maxRedemptions ? parseInt(maxRedemptions, 10) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Koden ${finalCode} skapad`);
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Skapa kampanjkod</DialogTitle>
          <DialogDescription>Ge användare PRO under en begränsad period.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np_code">Kod</Label>
            <div className="flex gap-2">
              <Input
                id="np_code" value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Lämna tom för auto" className="font-mono uppercase"
              />
              <Button type="button" variant="outline" onClick={() => setCode(genCode())}>Slumpa</Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np_desc">Beskrivning (intern)</Label>
            <Textarea id="np_desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Period</Label>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => setMode("rolling")}
                className={`flex-1 rounded-lg border px-3 py-2 text-[13px] text-left ${mode === "rolling" ? "border-v2-violet bg-v2-violet/5" : "border-v2-line"}`}
              >
                <div className="font-medium text-v2-ink">Rullande</div>
                <div className="text-v2-muted text-[12px]">X dagar från inlösen</div>
              </button>
              <button
                type="button" onClick={() => setMode("fixed")}
                className={`flex-1 rounded-lg border px-3 py-2 text-[13px] text-left ${mode === "fixed" ? "border-v2-violet bg-v2-violet/5" : "border-v2-line"}`}
              >
                <div className="font-medium text-v2-ink">Fast datumintervall</div>
                <div className="text-v2-muted text-[12px]">Alla får samma slutdatum</div>
              </button>
            </div>
          </div>

          {mode === "rolling" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np_days">Antal dagar</Label>
              <Input
                id="np_days" type="number" min={1} value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-[12px] text-v2-muted">PRO-perioden börjar när användaren löser in koden.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np_start">Från (valfri)</Label>
                <Input id="np_start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np_end">Till</Label>
                <Input id="np_end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Användning</Label>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => setUsageType("unique")}
                className={`flex-1 rounded-lg border px-3 py-2 text-[13px] text-left ${usageType === "unique" ? "border-v2-violet bg-v2-violet/5" : "border-v2-line"}`}
              >
                <div className="font-medium text-v2-ink">Unik</div>
                <div className="text-v2-muted text-[12px]">Kan endast lösas in en gång</div>
              </button>
              <button
                type="button" onClick={() => setUsageType("shared")}
                className={`flex-1 rounded-lg border px-3 py-2 text-[13px] text-left ${usageType === "shared" ? "border-v2-violet bg-v2-violet/5" : "border-v2-line"}`}
              >
                <div className="font-medium text-v2-ink">Delad</div>
                <div className="text-v2-muted text-[12px]">Flera användare kan lösa in</div>
              </button>
            </div>
            {usageType === "shared" && (
              <div className="flex flex-col gap-1.5 pt-1">
                <Label htmlFor="np_max">Max antal inlösningar (valfri)</Label>
                <Input
                  id="np_max" type="number" min={1} value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  placeholder="Lämna tom för obegränsat"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Skapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedemptionsDialog({
  promo, onOpenChange,
}: { promo: PromoCode | null; onOpenChange: (o: boolean) => void }) {
  const [rows, setRows] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!promo) return;
    setLoading(true);
    supabase.rpc("admin_list_promo_redemptions", { _promo_id: promo.id }).then(({ data, error }) => {
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      setRows((data ?? []) as Redemption[]);
    });
  }, [promo]);

  return (
    <Dialog open={!!promo} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inlösningar – <span className="font-mono">{promo?.code}</span></DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-center text-v2-muted py-8">Laddar…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-v2-muted py-8">Inga inlösningar än.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-post</TableHead>
                <TableHead>Inlöst</TableHead>
                <TableHead>Går ut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="text-[13px]">{r.email ?? r.user_id}</TableCell>
                  <TableCell className="text-[13px] text-v2-muted">{new Date(r.redeemed_at).toLocaleString("sv-SE")}</TableCell>
                  <TableCell className="text-[13px]">{new Date(r.expires_at).toLocaleString("sv-SE")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
