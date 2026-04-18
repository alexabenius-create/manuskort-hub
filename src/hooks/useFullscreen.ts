import { useEffect } from "react";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};
type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
};

/**
 * Försöker aktivera fullskärm vid mount och släppa vid unmount.
 * Tyst no-op på iPad Safari där API:et inte stöds — där förlitar vi oss
 * på PWA-installation (manifest display: standalone) för immersive look.
 */
export function useFullscreen(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const docEl = document.documentElement as FullscreenElement;
    const doc = document as FullscreenDocument;

    const requestFs = docEl.requestFullscreen?.bind(docEl) ?? docEl.webkitRequestFullscreen?.bind(docEl);
    const exitFs = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);

    if (requestFs) {
      requestFs().catch(() => {
        // iPad Safari mm. — fail silently
      });
    }

    return () => {
      const isFs = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (isFs && exitFs) {
        exitFs().catch(() => {});
      }
    };
  }, [enabled]);
}
