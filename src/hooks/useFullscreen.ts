import { useEffect } from "react";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};
type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
};

type ScreenOrientationLock = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait" | "any") => Promise<void>;
};

/**
 * Försöker aktivera fullskärm vid mount och släppa vid unmount.
 * Tyst no-op på iPad/iOS Safari där API:et inte stöds.
 *
 * Om `lockLandscape` är true försöker vi även låsa orientering till liggande
 * efter fullskärm aktiverats. Fungerar på Android Chrome; no-op på iOS.
 */
export function useFullscreen(enabled: boolean = true, lockLandscape: boolean = false) {
  useEffect(() => {
    if (!enabled) return;
    const docEl = document.documentElement as FullscreenElement;
    const doc = document as FullscreenDocument;

    const requestFs = docEl.requestFullscreen?.bind(docEl) ?? docEl.webkitRequestFullscreen?.bind(docEl);
    const exitFs = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);

    const tryLock = () => {
      if (!lockLandscape) return;
      const so = screen.orientation as ScreenOrientationLock | undefined;
      if (so?.lock) {
        so.lock("landscape").catch(() => {
          // iOS Safari + vissa desktop-browsers — fail silently
        });
      }
    };

    if (requestFs) {
      requestFs()
        .then(tryLock)
        .catch(() => {
          // iPad Safari mm. — fail silently. Försök ändå låsa orientering.
          tryLock();
        });
    } else {
      tryLock();
    }

    return () => {
      const so = screen.orientation as ScreenOrientationLock | undefined;
      if (so?.unlock) {
        try { so.unlock(); } catch { /* ignore */ }
      }
      const isFs = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (isFs && exitFs) {
        exitFs().catch(() => {});
      }
    };
  }, [enabled, lockLandscape]);
}
