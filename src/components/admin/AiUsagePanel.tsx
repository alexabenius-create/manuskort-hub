import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles } from "lucide-react";
import { AI_MONTHLY_LIMIT_PRO } from "@/lib/tierLimits";

interface UsageRow {
  user_id: string;
  count: number;
  email: string | null;
}

export function AiUsagePanel() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const month = new Date().toISOString().slice(0, 7);

    const { data: usage } = await supabase
      .from("ai_usage")
      .select("user_id, count")
      .eq("month", month)
      .order("count", { ascending: false });

    const list = (usage ?? []) as Array<{ user_id: string; count: number }>;
    const sum = list.reduce((acc, r) => acc + (r.count ?? 0), 0);
    setTotal(sum);

    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Fetch emails via admin_list_users (already exists)
    const { data: users } = await supabase.rpc("admin_list_users");
    const emailMap = new Map<string, string | null>();
    (users ?? []).forEach((u: { user_id: string; email: string | null }) => {
      emailMap.set(u.user_id, u.email);
    });

    setRows(
      list.map((r) => ({
        user_id: r.user_id,
        count: r.count,
        email: emailMap.get(r.user_id) ?? null,
      })),
    );
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">
          AI-användning
        </h2>
        <p className="text-v2-muted text-[15px] mt-2">
          Antal AI-förbättringar per användare denna månad. Pro-tak: {AI_MONTHLY_LIMIT_PRO}/mån.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Totalt denna månad" value={total} />
        <StatCard label="Aktiva användare" value={rows.length} />
        <StatCard
          label="Närmar sig taket"
          value={rows.filter((r) => r.count >= AI_MONTHLY_LIMIT_PRO * 0.8).length}
        />
      </div>

      <div className="rounded-2xl border border-v2-line bg-white/70 backdrop-blur-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Användare</TableHead>
              <TableHead className="text-right">Förbättringar</TableHead>
              <TableHead className="text-right">Andel av tak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-v2-muted">
                  Laddar…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-v2-muted">
                  Ingen AI-användning denna månad.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const pct = Math.round((r.count / AI_MONTHLY_LIMIT_PRO) * 100);
              const warn = pct >= 80;
              return (
                <TableRow key={r.user_id}>
                  <TableCell>{r.email ?? r.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-right font-mono">{r.count}</TableCell>
                  <TableCell
                    className={`text-right font-mono ${warn ? "text-orange-600 font-semibold" : ""}`}
                  >
                    {pct}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-v2-line bg-white/70 backdrop-blur-xl p-5">
      <div className="flex items-center gap-2 text-v2-muted text-sm mb-1">
        <Sparkles className="h-4 w-4" />
        {label}
      </div>
      <div className="font-display text-3xl font-semibold text-v2-ink">{value}</div>
    </div>
  );
}
