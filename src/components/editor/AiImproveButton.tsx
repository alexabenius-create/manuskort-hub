import { useEffect, useState } from "react";
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

interface Props {
  editor: Editor;
}

interface Suggestion {
  text: string;
  rationale: string;
}

export function AiImproveButton({ editor }: Props) {
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
      toast({ title: "Markera text först", description: "Välj en mening att förbättra." });
      return;
    }

    if (isFree) {
      setShowUpgrade(true);
      return;
    }

    if (isPro && usage && usage.remaining <= 0) {
      toast({
        title: "AI-kvot slut",
        description: `Du har använt månadens 200 AI-förbättringar. Återställs nästa månad.`,
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
        // Try to read structured error from response
        const ctx = (fnError as { context?: { error?: string } }).context;
        const code = ctx?.error;
        if (code === "monthly_limit_reached") {
          setError("Du har nått månadens AI-kvot (200/200).");
        } else if (code === "ai_credits_exhausted") {
          setError("AI-tjänsten är slut på kredit. Kontakta support.");
        } else if (code === "ai_rate_limited") {
          setError("För många förfrågningar just nu. Försök igen om en stund.");
        } else {
          setError(fnError.message || "Något gick fel.");
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
      setError(e instanceof Error ? e.message : "Något gick fel.");
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

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Förbättra med AI"
            title={
              isFree
                ? "Förbättra med AI (kräver PRO)"
                : `Förbättra med AI${usage ? ` — ${remaining}/${limit} kvar` : ""}`
            }
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
              Förbättra med AI
            </div>
            <div className="text-sm text-foreground line-clamp-3 italic">
              "{selectedText}"
            </div>
          </div>

          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Genererar förslag…
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
                    Använd
                  </Button>
                </div>
              ))}
          </div>

          {!isAdmin && usage && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              {remaining} av {limit} AI-förbättringar kvar denna månad
            </div>
          )}
        </PopoverContent>
      </Popover>

      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        title="AI-förbättring kräver PRO"
        description="Få AI-hjälp med att skriva tydligare, kortare och mer talvänliga meningar. Ingår i PRO."
      />
    </>
  );
}
