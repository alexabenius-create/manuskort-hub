import { useRef, useState, DragEvent } from "react";
import { Upload, FileText, X, Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detectFileKind, MAX_FILE_BYTES } from "@/lib/import/parseDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  file: File | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

type Source = "file" | "google";

export function UploadZone({ file, onFileSelected, onClear, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("file");
  const [googleUrl, setGoogleUrl] = useState("");
  const [fetchingGoogle, setFetchingGoogle] = useState(false);

  const validate = (f: File): string | null => {
    const kind = detectFileKind(f);
    if (kind === "doc") {
      return "Filformatet .doc stöds inte. Öppna filen i Word och spara om den som .docx (Arkiv → Spara som → Word-dokument). Försök sedan igen.";
    }
    if (kind === "unsupported") {
      return "Vi stödjer .docx och .txt i nuläget.";
    }
    if (f.size > MAX_FILE_BYTES) {
      return "Filen är för stor. Dela upp den i mindre delar eller kontakta oss.";
    }
    return null;
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onFileSelected(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const importFromGoogle = async () => {
    const url = googleUrl.trim();
    if (!url) {
      setError("Klistra in en Google Docs-länk först.");
      return;
    }
    setError(null);
    setFetchingGoogle(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "google-docs-import",
        { body: { url } },
      );

      if (fnError) {
        // Försök läsa svarstext om FunctionsError exponerar context
        const ctx = (fnError as { context?: { body?: unknown } }).context;
        let msg = fnError.message || "Kunde inte hämta dokumentet.";
        if (ctx?.body) {
          try {
            const txt = typeof ctx.body === "string"
              ? ctx.body
              : await (ctx.body as Response).text();
            const parsed = JSON.parse(txt);
            if (parsed?.error) msg = parsed.error;
          } catch { /* ignore */ }
        }
        setError(msg);
        return;
      }

      // Edge function returnerar binär .docx — Supabase SDK ger oss antingen
      // Blob (i web-runtime) eller annan struktur. Hantera båda.
      let blob: Blob | null = null;
      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data]);
      } else if (data && typeof data === "object" && "size" in data) {
        blob = data as unknown as Blob;
      }
      if (!blob) {
        setError("Oväntat svarsformat från servern.");
        return;
      }

      const filename = "Google-dokument.docx";
      const f = new File([blob], filename, {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      handleFile(f);
      setGoogleUrl("");
      toast({
        title: "Hämtade från Google Docs",
        description: filename,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Okänt fel vid hämtning.";
      setError(msg);
    } finally {
      setFetchingGoogle(false);
    }
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-2">
        <div className="h-10 w-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-accent-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium truncate">{file.name}</p>
          <p className="text-[12px] text-muted-foreground">
            {(file.size / 1024).toFixed(0)} KB · {detectFileKind(file).toUpperCase()}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={onClear}
          disabled={disabled}
        >
          <X className="h-4 w-4" /> Byt fil
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Källväljare */}
      <div className="seg-group inline-flex">
        <button
          type="button"
          data-active={source === "file"}
          onClick={() => { setSource("file"); setError(null); }}
          className="seg-btn"
          disabled={disabled}
        >
          <Upload className="h-3.5 w-3.5" /> Fil
        </button>
        <button
          type="button"
          data-active={source === "google"}
          onClick={() => { setSource("google"); setError(null); }}
          className="seg-btn"
          disabled={disabled}
        >
          <LinkIcon className="h-3.5 w-3.5" /> Google Docs-länk
        </button>
      </div>

      {source === "file" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          disabled={disabled}
          className={`w-full rounded-2xl border-2 border-dashed transition-colors p-10 flex flex-col items-center gap-3 ${
            drag
              ? "border-accent-blue bg-accent-blue/5"
              : "border-border bg-surface hover:bg-surface-2"
          }`}
        >
          <div className="h-12 w-12 rounded-2xl bg-surface-2 flex items-center justify-center">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-medium">Släpp en fil här eller klicka för att välja</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              .docx eller .txt — max 5 MB
            </p>
          </div>
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-blue/10 flex items-center justify-center shrink-0">
              <LinkIcon className="h-5 w-5 text-accent-blue" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-[14px] font-medium">Importera från Google Docs</p>
              <p className="text-[12px] text-muted-foreground leading-snug">
                Öppna dokumentet → klicka <span className="font-medium">Dela</span> → välj{" "}
                <span className="font-medium">"Alla med länken kan visa"</span>. Klistra sedan in URL:en nedan.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://docs.google.com/document/d/…"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!fetchingGoogle && googleUrl.trim()) importFromGoogle();
                }
              }}
              disabled={disabled || fetchingGoogle}
              className="rounded-xl"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              onClick={importFromGoogle}
              disabled={disabled || fetchingGoogle || !googleUrl.trim()}
              className="rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-white shrink-0"
            >
              {fetchingGoogle ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Hämtar
                </>
              ) : (
                "Hämta"
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Vi konverterar dokumentet till .docx och kör samma import-flöde som vid uppladdning.
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".docx,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="text-[13px] text-destructive px-2 pt-1">{error}</p>
      )}
    </div>
  );
}
