// TODO: Radera denna fil senast 2026-05-03.
// v1/v2 är utfasade — v3 är enda aktiva editorn sedan 2026-04-19.
// Hooken används inte längre i appen — DB-kolumnen profiles.editor_preference
// läses/skrivs inte. Filen ligger kvar som referens under sunset-perioden.
/**
 * useEditorPreference — läser/skriver profiles.editor_preference.
 *
 * Sunset-mekanik:
 * - Default 'v3' för alla.
 * - Användare kan opt:a tillbaka till 'v1' (sparas i DB → gäller alla enheter).
 * - Emergency-ventil: VITE_EMERGENCY_FORCE_V1=true tvingar alla till v1.
 *
 * Sunset-timeline (mjuk):
 *   Vecka 0: Cutover (default v3, opt-out aktiv)
 *   Vecka 4: Opt-out-länken tas bort från topbar (åtkomlig via Settings)
 *   Vecka 8: v1-preferensen ignoreras, alla får v3. v1-koden raderas.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type EditorVersion = "v1" | "v3";

const EMERGENCY_FORCE_V1 = import.meta.env.VITE_EMERGENCY_FORCE_V1 === "true";

interface Ctx {
  preference: EditorVersion;
  loading: boolean;
  emergencyForceV1: boolean;
  setPreference: (next: EditorVersion) => Promise<void>;
}

const EditorPreferenceContext = createContext<Ctx | null>(null);

export function EditorPreferenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preference, setPreferenceState] = useState<EditorVersion>("v3");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("editor_preference")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const pref = (data as { editor_preference?: EditorVersion } | null)?.editor_preference ?? "v3";
      setPreferenceState(pref);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setPreference = useCallback(
    async (next: EditorVersion) => {
      if (!user) return;
      setPreferenceState(next);
      await supabase
        .from("profiles")
        .update({ editor_preference: next } as never)
        .eq("user_id", user.id);
    },
    [user],
  );

  const value = useMemo<Ctx>(
    () => ({ preference, loading, emergencyForceV1: EMERGENCY_FORCE_V1, setPreference }),
    [preference, loading, setPreference],
  );

  return <EditorPreferenceContext.Provider value={value}>{children}</EditorPreferenceContext.Provider>;
}

export function useEditorPreference(): Ctx {
  const ctx = useContext(EditorPreferenceContext);
  if (!ctx) throw new Error("useEditorPreference must be used inside EditorPreferenceProvider");
  return ctx;
}

/** Effektiv version efter emergency-override. */
export function resolveEditorVersion(pref: EditorVersion, emergencyForceV1: boolean): EditorVersion {
  if (emergencyForceV1) return "v1";
  return pref;
}
