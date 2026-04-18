import { useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export type WakeLockStatus = "unsupported" | "active" | "inactive" | "error";

/**
 * Håller skärmen vaken så länge komponenten är monterad.
 * Re-requestar automatiskt vid `visibilitychange` när sidan blir synlig igen
 * (vissa webbläsare släpper låset när tabben backgroundas).
 */
export function useWakeLock(enabled: boolean = true) {
  const [status, setStatus] = useState<WakeLockStatus>("inactive");
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;

    const request = async () => {
      try {
        const sentinel = await nav.wakeLock!.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setStatus("active");
        sentinel.addEventListener("release", () => {
          if (!cancelled) setStatus("inactive");
        });
      } catch (err) {
        console.warn("[useWakeLock] request failed", err);
        if (!cancelled) setStatus("error");
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && sentinelRef.current?.released !== false) {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };
  }, [enabled]);

  return status;
}
