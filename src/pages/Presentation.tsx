import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useFullscreen } from "@/hooks/useFullscreen";
import { formatTargetDuration } from "@/components/editor/TargetDurationDialog";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"] & {
  target_duration_seconds: number | null;
};
type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card: boolean;
};

export default function Presentation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const wakeLockStatus = useWakeLock(true);
  useFullscreen(true);

  // Visa info en gång om Wake Lock saknas
  useEffect(() => {
    if (wakeLockStatus === "unsupported") {
      toast("Skärmen kan slockna under presentationen", {
        description: "Din webbläsare stöder inte att hålla skärmen vaken. Sätt skärmtimeout till högsta värdet i systeminställningarna.",
        duration: 6000,
      });
    }
  }, [wakeLockStatus]);

  // Avsluta med Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        navigate(`/manus/${id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, navigate]);

  // Ladda data
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [mRes, cRes] = await Promise.all([
        supabase.from("manuscripts").select("*").eq("id", id).maybeSingle(),
        supabase.from("cards").select("*").eq("manuscript_id", id).order("position"),
      ]);
      if (mRes.error || !mRes.data) {
        toast.error("Kunde inte ladda manuset", { description: mRes.error?.message });
        navigate("/");
        return;
      }
      setManuscript(mRes.data as Manuscript);
      setCards((cRes.data ?? []) as Card[]);
      setLoading(false);
    })();
  }, [id, navigate]);

  const wakeLockLabel = (() => {
    switch (wakeLockStatus) {
      case "active": return "Wake Lock: aktiv";
      case "inactive": return "Wake Lock: vilande";
      case "unsupported": return "Wake Lock: stöds inte";
      case "error": return "Wake Lock: fel";
    }
  })();

  const wakeLockColor = (() => {
    switch (wakeLockStatus) {
      case "active": return "text-emerald-400";
      case "inactive": return "text-zinc-400";
      case "unsupported": return "text-amber-400";
      case "error": return "text-red-400";
    }
  })();

  const wakeLockDot = (() => {
    switch (wakeLockStatus) {
      case "active": return "bg-emerald-400";
      case "inactive": return "bg-zinc-500";
      case "unsupported": return "bg-amber-400";
      case "error": return "bg-red-400";
    }
  })();

  const panicCount = cards.filter((c) => c.is_panic_card).length;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 overflow-hidden flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/manus/${id}`)}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            aria-label="Avsluta presentationsläge"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Placeholders för vy-toggle och tids-toggle (kommer i nästa steg) */}
          <span className="font-mono text-[11px] text-zinc-600 uppercase tracking-wider">
            Presentationsläge
          </span>
        </div>

        <div className={`inline-flex items-center gap-2 font-mono text-[11px] ${wakeLockColor}`} aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${wakeLockDot} ${wakeLockStatus === "active" ? "animate-pulse" : ""}`} />
          {wakeLockLabel}
        </div>
      </header>

      {/* Innehåll — placeholder för denna körning */}
      <main className="flex-1 flex items-center justify-center px-6">
        {loading ? (
          <p className="text-zinc-500 text-[14px]">Laddar manus…</p>
        ) : (
          <div className="max-w-md text-center flex flex-col gap-6">
            <p className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
              {manuscript?.title}
            </p>
            <p className="text-zinc-400 text-[15px] leading-relaxed">
              Presentationsläget — fundamentet är på plats. Nästa steg bygger korten,
              navigeringen och tidsmodulen.
            </p>
            <dl className="grid grid-cols-2 gap-3 text-[12px] font-mono text-left bg-zinc-900/50 rounded-xl p-4">
              <dt className="text-zinc-500">Läge</dt>
              <dd className="text-zinc-300">{manuscript?.mode}</dd>
              <dt className="text-zinc-500">Antal kort</dt>
              <dd className="text-zinc-300">{cards.length}</dd>
              <dt className="text-zinc-500">Panik-kort</dt>
              <dd className="text-zinc-300">{panicCount}</dd>
              <dt className="text-zinc-500">Måltid</dt>
              <dd className="text-zinc-300">
                {manuscript?.target_duration_seconds
                  ? formatTargetDuration(manuscript.target_duration_seconds)
                  : "—"}
              </dd>
            </dl>
            <p className="text-zinc-600 text-[12px]">
              Tryck <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">Esc</kbd> eller klicka på <X className="inline h-3 w-3 mb-0.5" /> för att avsluta.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
