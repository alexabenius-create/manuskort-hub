import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Paperclip, Sparkles, X, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";
import {
  extractDocumentText,
  fileExtension,
  formatFileSize,
  isAllowedFile,
  MAX_FILE_BYTES,
  LARGE_FILE_WARN_BYTES,
} from "@/lib/extractDocumentText";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLES = [
  { emoji: "💼", text: "2 min anförande mot S om förskola" },
  { emoji: "💬", text: "Replik på oppositionens kritik av cykelbanan" },
  { emoji: "🏛", text: "Inlägg om varför vi behöver bygga ut äldreboendet" },
];

const MAX_CONTEXT_CHARS = 50_000;
const MIN_CONTEXT_CHARS = 50;

export function SnabbstartModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reading" | "intake" | "drafting">("idle");
  const [file, setFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      void trackEvent(ANALYTICS_EVENTS.SNABBSTART_OPENED, {});
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      setText("");
      setFile(null);
      setLoading(false);
      setReadingFile(false);
      setPhase("idle");
    }
  }, [open]);

  const handleExample = (example: string) => {
    setText(example);
    void trackEvent(ANALYTICS_EVENTS.SNABBSTART_EXAMPLE_CLICKED, {});
    textareaRef.current?.focus();
  };

  const handleFilePick = (picked: File | null) => {
    if (!picked) return;
    if (!isAllowedFile(picked)) {
      toast({
        title: "Filen kunde inte bifogas",
        description: `Filen är för stor (max ${MAX_FILE_BYTES / (1024 * 1024)} MB) — eller ej tillåtet format (PDF, DOCX, TXT).`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(picked);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setPhase(file ? "reading" : "intake");

    try {
      let attached_context: string | undefined;
      if (file) {
        setReadingFile(true);
        try {
          const raw = await extractDocumentText(file);
          const cleaned = raw.replace(/\s+/g, " ").trim();
          if (cleaned.length < MIN_CONTEXT_CHARS) {
            toast({
              title: "Kunde inte läsa dokumentet",
              description: "Försök med ett annat format eller ett tydligare dokument.",
              variant: "destructive",
            });
            setLoading(false);
            setReadingFile(false);
            setPhase("idle");
            return;
          }
          attached_context = cleaned.slice(0, MAX_CONTEXT_CHARS);
        } catch (e) {
          console.error("[snabbstart] extract failed", e);
          toast({
            title: "Kunde inte läsa dokumentet",
            description: "Filen är skadad eller i fel format.",
            variant: "destructive",
          });
          setLoading(false);
          setReadingFile(false);
          setPhase("idle");
          return;
        }
        setReadingFile(false);
        setPhase("intake");
      }

      const { data, error } = await supabase.functions.invoke("quick-intake", {
        body: { text: trimmed, attached_context, file_type: file ? fileExtension(file) : undefined },
      });

      if (error) {
        // deno-lint-ignore no-explicit-any
        const ctx = (error as any).context;
        let status: number | undefined;
        let errorCode: string | undefined;
        try {
          if (ctx?.json) {
            const j = await ctx.json();
            errorCode = j?.error;
            status = ctx.status;
          } else if (ctx?.status) {
            status = ctx.status;
          }
        } catch (_e) {
          // ignore
        }
        if (status === 401 || errorCode === "auth") {
          toast({ title: "Inloggning krävs", description: "Logga in för att använda Snabbstart.", variant: "destructive" });
          return;
        }
        if (status === 403 || errorCode === "tier" || errorCode === "feature_disabled" || errorCode === "beta_required") {
          toast({
            title: "Pro-tier krävs",
            description: "Snabbstart är tillgängligt för Pro. Uppgradera för att använda.",
            variant: "destructive",
          });
          return;
        }
        if (status === 502 || errorCode === "llm_failed") {
          toast({ title: "Boten är upptagen", description: "Försök igen om en minut.", variant: "destructive" });
          return;
        }
        throw new Error(errorCode || error.message || "Okänt fel");
      }

      if (data?.error) {
        if (data.error === "feature_disabled" || data.error === "tier") {
          toast({
            title: "Pro-tier krävs",
            description: "Snabbstart är tillgängligt för Pro. Uppgradera för att använda.",
            variant: "destructive",
          });
          return;
        }
        if (data.error === "llm_failed") {
          toast({ title: "Boten är upptagen", description: "Försök igen om en minut.", variant: "destructive" });
          return;
        }
        throw new Error(String(data.error));
      }

      const { thread_id, manuscript_id, fallback } = data ?? {};
      if (!thread_id || !manuscript_id) throw new Error("Ofullständigt svar");

      if (fallback) {
        toast({
          title: "Vi tar det steg för steg",
          description: "Jag kunde inte tolka allt — vi tar det steg för steg istället. ✨",
        });
      }

      setPhase("drafting");
      onOpenChange(false);
      navigate(`/manus/${manuscript_id}?debattbuddy=${thread_id}`);
    } catch (e) {
      console.error("[snabbstart] submit failed", e);
      toast({
        title: "Snabbstart",
        description: "Hoppsan, något strulade. Försök igen om en stund.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setReadingFile(false);
      setPhase("idle");
    }
  };

  const fileEmoji = file ? (fileExtension(file) === "pdf" ? "📄" : fileExtension(file) === "docx" ? "📝" : "📃") : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Zap className="h-6 w-6 text-primary" />
            Snabbstart
          </DialogTitle>
          <DialogDescription>
            Beskriv kort vad du behöver hjälp med — boten förstår.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="T.ex. '2 min anförande mot S om förskola' eller 'Replik på oppositionens kritik av cykelbanan'"
            className="min-h-[100px] resize-none"
            disabled={loading}
            maxLength={1000}
          />

          {/* Filuppladdning */}
          <div className="space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
            {file ? (
              <>
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm">
                  <span className="truncate">
                    <span className="mr-1.5">{fileEmoji}</span>
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground"> · {formatFileSize(file.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={loading}
                    className="shrink-0 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                    Ta bort
                  </button>
                </div>
                {file.size > LARGE_FILE_WARN_BYTES && (
                  <div className="text-[12px] text-destructive/80 px-1 pt-1">
                    ⚠️ Stor fil ({formatFileSize(file.size)}). Filer över 5 MB kan göra det långsammare att få fram anförandet.
                  </div>
                )}
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" />
                Bifoga underlag (valfritt)
              </Button>
            )}
            <div className="text-[11px] text-muted-foreground px-1">
              Boten läser dokumentet som bakgrund. Sparas inte permanent. PDF, DOCX eller TXT, max 15 MB.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[12px] text-muted-foreground">Exempel — klicka för att ladda</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.text}
                  type="button"
                  onClick={() => handleExample(ex.text)}
                  disabled={loading}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted hover:border-primary/40 transition-colors disabled:opacity-50"
                >
                  <span className="mr-1">{ex.emoji}</span>
                  {ex.text}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || loading}
            size="lg"
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === "reading"
                  ? "📄 Läser dokumentet..."
                  : phase === "drafting"
                  ? "✍️ Skriver utkastet — det här tar lite längre tid med underlag (upp till 3 min)..."
                  : file
                  ? "🤔 Tolkar din uppgift..."
                  : "Tänker..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Skapa nu
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
