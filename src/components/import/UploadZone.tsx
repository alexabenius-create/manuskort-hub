import { useRef, useState, DragEvent } from "react";
import { Upload, FileText, X, Link as LinkIcon, Loader2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("file");
  const [googleUrl, setGoogleUrl] = useState("");
  const [fetchingGoogle, setFetchingGoogle] = useState(false);

  const validate = (f: File): string | null => {
    const kind = detectFileKind(f);
    if (kind === "doc") {
      return t("import.upload.validate_doc");
    }
    if (kind === "unsupported") {
      return t("import.upload.validate_unsupported");
    }
    if (f.size > MAX_FILE_BYTES) {
      return t("import.upload.validate_too_large");
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
      setError(t("import.upload.google_url_required"));
      return;
    }
    setError(null);
    setFetchingGoogle(true);
    try {
      // Vi kringgår supabase.functions.invoke() här eftersom den försöker
      // JSON-parsa svaret. Edge-funktionen returnerar binär .docx, så vi
      // hämtar via fetch och läser body som ArrayBuffer.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/google-docs-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        let msg = t("import.upload.google_http_error", { status: res.status });
        try {
          const parsed = await res.json();
          if (parsed?.error) msg = parsed.error;
        } catch { /* binärt svar utan JSON-fel */ }
        setError(msg);
        return;
      }

      const buf = await res.arrayBuffer();
      if (!buf || buf.byteLength < 100) {
        setError(t("import.upload.google_empty_response"));
        return;
      }

      // Plocka ut filnamn från X-Filename eller Content-Disposition
      let filename = t("import.upload.google_default_filename");
      const xName = res.headers.get("x-filename");
      if (xName) {
        try { filename = decodeURIComponent(xName); } catch { filename = xName; }
      } else {
        const dispo = res.headers.get("content-disposition");
        const m = dispo?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
        if (m && m[1]) {
          try { filename = decodeURIComponent(m[1]); } catch { filename = m[1]; }
        }
      }

      const f = new File([buf], filename, {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      handleFile(f);
      setGoogleUrl("");
      toast({
        title: t("import.upload.google_toast_title"),
        description: filename,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("import.upload.google_unknown_error");
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
          <X className="h-4 w-4" /> {t("import.upload.change_file")}
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
