import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useTier } from "@/hooks/useTier";
import { useAiUsage } from "@/hooks/useAiUsage";
import { UpgradeModal } from "@/components/UpgradeModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Props {
  editor: Editor;
}

interface Suggestion {
  text: string;
  rationale: string;
}

export function AiImproveButton({ editor }: Props) {
  const { t } = useTranslation();
  const { isFree, isPro, isAdmin } = useTier();
  const { usage, refresh } = useAiUsage();
  const [open, setOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");

  const handleClick = async () => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ").trim();
    if (!text || text.length < 2) {
      toast({
        title: t("editor.card.ai_select_first_title"),
        description: t("editor.card.ai_select_first_desc"),
      });
      return;
    }

    if (isFree) {
      setShowUpgrade(true);
      return;
    }

    if (isPro && usage && usage.remaining <= 0) {
      toast({
        title: t("editor.card.ai_quota_title"),
        description: t("editor.card.ai_quota_desc"),
        variant: "destructive",
      });
      return;
    }

    setSelectedText(text);
    setSuggestions([]);
    setError(null);
    setOpen(true);
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("improve-sentence", {
        body: { text },
      });

      if (fnError) {
        const ctx = (fnError as { context?: { error?: string } }).context;
        const code = ctx?.error;
        if (code === "monthly_limit_reached") {
          setError(t("editor.card.ai_error_monthly_limit"));
        } else if (code === "ai_credits_exhausted") {
          setError(t("editor.card.ai_error_credits"));
        } else if (code === "ai_rate_limited") {
          setError(t("editor.card.ai_error_rate_limit"));
        } else {
          setError(fnError.message || t("editor.card.ai_error_unknown"));
        }
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuggestions(data?.suggestions ?? []);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("editor.card.ai_error_unknown"));
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (text: string) => {
    editor.chain().focus().insertContent(text).run();
    setOpen(false);
  };

  const remaining = usage?.remaining ?? 0;
  const limit = usage?.limit ?? 0;

  const titleAttr = isFree
    ? t("editor.card.ai_improve_tip_free")
    : usage
      ? t("editor.card.ai_improve_tip_pro_with_quota", { remaining, limit })
      : t("editor.card.ai_improve_tip_pro");

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("editor.card.ai_improve_aria")}
            title={titleAttr}
            onClick={handleClick}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              "text-foreground/80 hover:bg-muted hover:text-foreground",
              "relative",
            )}
          >
            <Sparkles className="h-4 w-4" />
            {isFree && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-blue" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[360px] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-3 border-b">
            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {t("editor.card.ai_panel_title")}
            </div>
            <div className="text-sm text-foreground line-clamp-3 italic">
              "{selectedText}"
            </div>
          </div>

          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("editor.card.ai_loading")}
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-2 text-sm text-destructive py-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading &&
              !error &&
              suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-md border p-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm text-foreground mb-1.5">{s.text}</div>
                  {s.rationale && (
                    <div className="text-xs text-muted-foreground mb-2">{s.rationale}</div>
                  )}
                  <Button
                    size="sm"
                    onClick={() => applySuggestion(s.text)}
                    className="h-7 rounded-full text-xs"
                  >
                    {t("editor.card.ai_apply")}
                  </Button>
                </div>
              ))}
          </div>

          {!isAdmin && usage && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              {t("editor.card.ai_quota_remaining", { remaining, limit })}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        title={t("editor.card.ai_upgrade_title")}
        description={t("editor.card.ai_upgrade_desc")}
      />
    </>
  );
}
