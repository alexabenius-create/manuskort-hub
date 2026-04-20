import { useEffect, useState } from "react";

/**
 * Detekterar enhetens orientering. Returnerar `"portrait"` eller `"landscape"`.
 * Använder matchMedia + lyssnar på orienteringsändringar.
 */
export function useOrientation(): "portrait" | "landscape" {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(() => {
    if (typeof window === "undefined") return "portrait";
    return window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
  });

  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape)");
    const onChange = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? "landscape" : "portrait");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return orientation;
}
