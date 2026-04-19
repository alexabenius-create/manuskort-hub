/**
 * SunsetBanner — visas i v1-editorn för att påminna om att den läggs ner.
 *
 * Knappen "Byt till nya editorn" sätter editor_preference='v3' och navigerar
 * till samma manus i v3.
 */
import { useNavigate, useParams, Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useEditorPreference } from "@/hooks/useEditorPreference";
import { toast } from "sonner";

const DISMISS_KEY = "editor.sunsetBannerDismissed";

export function SunsetBanner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setPreference } = useEditorPreference();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  const onDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const onSwitch = async () => {
    await setPreference("v3");
    toast.success("Bytt till nya editorn");
    navigate(`/manus/${id}/v3`);
  };

  return (
    <div className="border-b border-accent-blue/20 bg-accent-blue/5">
      <div className="max-w-[920px] mx-auto px-5 sm:px-8 py-2.5 flex items-center gap-3 text-[13px]">
        <Sparkles className="h-3.5 w-3.5 text-accent-blue flex-shrink-0" />
        <p className="flex-1 text-foreground/80">
          Den här editorn (v1) <strong>läggs ner inom kort</strong>. Nya editorn har bättre flöde mellan kort, snabbare paste och fler kortkommandon.{" "}
          <Link to="/installningar" className="underline hover:text-accent-blue">
            Läs mer
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={onSwitch}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-blue text-white text-[12px] font-medium hover:bg-accent-blue/90 transition-colors flex-shrink-0"
        >
          Prova nya editorn
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Stäng påminnelse"
          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
