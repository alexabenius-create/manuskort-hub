import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { TOURS, type TourId } from "@/lib/tours";

interface ProfileFlags {
  bibliotek_tour_completed: boolean;
  manus_tour_completed: boolean;
}

interface TourCtx {
  flags: ProfileFlags | null;
  loading: boolean;
  startTour: (id: TourId) => void;
  resetTour: (id: TourId) => Promise<void>;
  reloadFlags: () => Promise<void>;
}

const Ctx = createContext<TourCtx>({
  flags: null,
  loading: true,
  startTour: () => {},
  resetTour: async () => {},
  reloadFlags: async () => {},
});

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [flags, setFlags] = useState<ProfileFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTour, setActiveTour] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const reloadFlags = useCallback(async () => {
    if (!user) {
      setFlags(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("bibliotek_tour_completed, manus_tour_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[Tour] Kunde inte läsa profile-flaggor", error);
      setFlags({ bibliotek_tour_completed: false, manus_tour_completed: false });
    } else if (data) {
      setFlags(data as ProfileFlags);
    } else {
      // Profile-rad saknas — skapa en
      await supabase.from("profiles").insert({ user_id: user.id, email: user.email ?? null });
      setFlags({ bibliotek_tour_completed: false, manus_tour_completed: false });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reloadFlags();
  }, [reloadFlags]);

  const startTour = useCallback((id: TourId) => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setActiveTour(id);
    setStepIndex(0);
  }, []);

  const completeTour = useCallback(
    async (id: TourId) => {
      if (!user) return;
      const update =
        id === "bibliotek"
          ? { bibliotek_tour_completed: true }
          : { manus_tour_completed: true };
      await supabase.from("profiles").update(update).eq("user_id", user.id);
      setFlags((prev) => (prev ? { ...prev, ...update } : prev));
    },
    [user]
  );

  const closeTour = useCallback(
    (markCompleted: boolean) => {
      const id = activeTour;
      setActiveTour(null);
      setStepIndex(0);
      // Återlämna fokus
      previousFocusRef.current?.focus?.();
      if (id && markCompleted) {
        void completeTour(id);
      }
    },
    [activeTour, completeTour]
  );

  const handleAdvance = useCallback(() => {
    if (!activeTour) return;
    const total = TOURS[activeTour].steps.length;
    if (stepIndex + 1 >= total) {
      closeTour(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [activeTour, stepIndex, closeTour]);

  const handleSkip = useCallback(() => {
    closeTour(true);
  }, [closeTour]);

  const resetTour = useCallback(
    async (id: TourId) => {
      if (!user) return;
      const update =
        id === "bibliotek"
          ? { bibliotek_tour_completed: false }
          : { manus_tour_completed: false };
      await supabase.from("profiles").update(update).eq("user_id", user.id);
      setFlags((prev) => (prev ? { ...prev, ...update } : prev));
    },
    [user]
  );

  const value = useMemo(
    () => ({ flags, loading, startTour, resetTour, reloadFlags }),
    [flags, loading, startTour, resetTour, reloadFlags]
  );

  // Scroll-lock medan tour körs
  useEffect(() => {
    if (!activeTour) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [activeTour]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {activeTour && (
        <TourOverlay
          steps={TOURS[activeTour].steps}
          stepIndex={stepIndex}
          onAdvance={handleAdvance}
          onSkip={handleSkip}
        />
      )}
    </Ctx.Provider>
  );
}

export const useTour = () => useContext(Ctx);

/**
 * Hook som triggar en rundtur när villkor är uppfyllt och flaggan är false.
 * Kör bara EN gång per session per tour (även om condition flippar).
 */
export function useTourTrigger(id: TourId, condition: boolean, delayMs = 400) {
  const { flags, loading, startTour } = useTour();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (loading || !flags || triggeredRef.current || !condition) return;
    const flag = TOURS[id].flag;
    if (flags[flag]) return; // Redan klar

    triggeredRef.current = true;
    const timer = setTimeout(() => startTour(id), delayMs);
    return () => clearTimeout(timer);
  }, [id, condition, loading, flags, startTour, delayMs]);
}
