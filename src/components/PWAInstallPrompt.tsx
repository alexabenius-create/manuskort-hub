import { useEffect, useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const DISMISS_KEY = "pwa-prompt-dismissed";
const SESSION_KEY = "pwa-prompt-dismissed-session";
const SHOW_DELAY_MS = 1500;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Diskret bottenbanner som tipsar mobila användare att lägga till Manuskort
 * på hemskärmen för fullskärmsupplevelse utan Safari/Chrome-chrome.
 *
 * - iOS Safari: visar manuella instruktioner (Dela → Lägg till på hemskärmen).
 * - Android Chrome: använder beforeinstallprompt → native install-dialog.
 * - Stäng (✕) → göms denna session.
 * - "Visa inte igen" + Stäng → göms permanent (localStorage).
 */
export function PWAInstallPrompt() {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  useEffect(() => {
    if (!isMobile || isStandalone) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "permanent") return;
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [isMobile, isStandalone]);

  // Lyssna på Androids beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    try {
      if (dontShowAgain) {
        localStorage.setItem(DISMISS_KEY, "permanent");
      } else {
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      try {
        localStorage.setItem(DISMISS_KEY, "permanent");
      } catch {
        /* ignore */
      }
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isMobile || isStandalone || !visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[55] animate-in slide-in-from-bottom duration-300"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="dialog"
      aria-label="Lägg till Manuskort på hemskärmen"
    >
      <div className="mx-auto max-w-md border-t border-border bg-popover/95 backdrop-blur-md shadow-2xl">
        <div className="relative px-4 pt-4 pb-3">
          <button
            onClick={dismiss}
            className="absolute top-2 right-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Stäng"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-[14px] font-semibold leading-tight">
                Lägg Manuskort på hemskärmen
              </p>
              {isIOS ? (
                <p className="text-muted-foreground text-[12px] leading-snug mt-1">
                  Tryck på <Share className="inline h-3.5 w-3.5 mx-0.5 -mt-0.5" /> i Safari och välj{" "}
                  <span className="text-foreground/80 whitespace-nowrap">
                    <Plus className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                    Lägg till på hemskärmen
                  </span>{" "}
                  för fullskärm utan adressfält.
                </p>
              ) : deferredPrompt ? (
                <p className="text-muted-foreground text-[12px] leading-snug mt-1">
                  Få fullskärmsläge utan webbläsar-chrome — perfekt vid presentation.
                </p>
              ) : (
                <p className="text-muted-foreground text-[12px] leading-snug mt-1">
                  Öppna webbläsarens meny och välj "Lägg till på hemskärmen" för fullskärmsläge.
                </p>
              )}
            </div>
          </div>

          {!isIOS && deferredPrompt && (
            <div className="mt-3 pl-[52px]">
              <Button
                size="sm"
                onClick={handleAndroidInstall}
                className="h-8 text-[13px]"
              >
                Installera
              </Button>
            </div>
          )}

          <label className="mt-3 flex items-center gap-2 pl-[52px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            <span className="text-muted-foreground text-[12px]">Visa inte igen</span>
          </label>
        </div>
      </div>
    </div>
  );
}
