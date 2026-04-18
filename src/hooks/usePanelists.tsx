import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { nextPanelistColor } from "@/lib/panelistColors";
import type { Database } from "@/integrations/supabase/types";

export type Panelist = Database["public"]["Tables"]["panelists"]["Row"];

interface Ctx {
  panelists: Panelist[];
  loading: boolean;
  add: () => Promise<Panelist | null>;
  rename: (id: string, name: string) => void;
  recolor: (id: string, color: string) => void;
  remove: (id: string) => Promise<void>;
}

const PanelistsContext = createContext<Ctx | null>(null);

export function PanelistsProvider({
  manuscriptId,
  children,
}: {
  manuscriptId: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [panelists, setPanelists] = useState<Panelist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!manuscriptId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("panelists")
        .select("*")
        .eq("manuscript_id", manuscriptId)
        .order("position");
      if (!cancelled) {
        setPanelists(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manuscriptId]);

  const add = useCallback(async () => {
    if (!user) return null;
    const used = panelists.map((p) => p.color);
    const color = nextPanelistColor(used);
    const position = panelists.length;
    const { data, error } = await supabase
      .from("panelists")
      .insert({
        manuscript_id: manuscriptId,
        user_id: user.id,
        name: "",
        color,
        position,
      })
      .select()
      .single();
    if (error || !data) return null;
    setPanelists((prev) => [...prev, data]);
    return data;
  }, [manuscriptId, panelists, user]);

  // Optimistic local update + debounced persistence
  const persist = useCallback(
    async (id: string, patch: Partial<Panelist>) => {
      await supabase.from("panelists").update(patch).eq("id", id);
    },
    []
  );

  const rename = useCallback(
    (id: string, name: string) => {
      setPanelists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
      void persist(id, { name });
    },
    [persist]
  );

  const recolor = useCallback(
    (id: string, color: string) => {
      setPanelists((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
      void persist(id, { color });
    },
    [persist]
  );

  const remove = useCallback(async (id: string) => {
    setPanelists((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("panelists").delete().eq("id", id);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ panelists, loading, add, rename, recolor, remove }),
    [panelists, loading, add, rename, recolor, remove]
  );

  return <PanelistsContext.Provider value={value}>{children}</PanelistsContext.Provider>;
}

export function usePanelists() {
  const ctx = useContext(PanelistsContext);
  if (!ctx) throw new Error("usePanelists must be used inside PanelistsProvider");
  return ctx;
}
