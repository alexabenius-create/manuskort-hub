import { useRef, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ACCEPT = ".pdf,.docx,.pptx";
const MAX_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

interface Props {
  onParsed: (args: { summary: string; fullText: string; fileName: string }) => void;
  onCleared: () => void;
  loadedFileName?: string | null;
}

export function IssueUpload({ onParsed, onCleared, loadedFileName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({ title: "Filen är för stor", description: "Max 10 MB.", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const expectedMime = MIME_BY_EXT[ext];
    if (!expectedMime) {
      toast({ title: "Filformat stöds inte", description: "Tillåtna format: PDF, DOCX, PPTX.", variant: "destructive" });
      return;
    }
    // Browsers ger ibland tom mime — patcha
    const blob = file.type ? file : new File([file], file.name, { type: expectedMime });

    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast({ title: "Du behöver vara inloggad", variant: "destructive" });
        return;
      }
      const formData = new FormData();
      formData.append("file", blob);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-issue-document`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const code = json?.error || `HTTP ${resp.status}`;
        const map: Record<string, string> = {
          monthly_limit_reached: "Månadens AI-kvot är slut.",
          ai_credits_exhausted: "AI-tjänsten saknar kredit just nu.",
          ai_rate_limited: "För många AI-anrop just nu, vänta en stund.",
          ai_timeout: "AI-tjänsten tog för lång tid. Försök med en mindre eller kortare fil.",
          beta_locked: "BETA-funktionen är inte upplåst för dig.",
          pro_required: "PRO krävs för att läsa upp ärenden.",
        };
        toast({ title: "Kunde inte läsa dokumentet", description: map[code] || code, variant: "destructive" });
        return;
      }

      onParsed({ summary: json.summary, fullText: json.full_text, fileName: file.name });
      toast({ title: "Ärendet är inläst", description: `${file.name} (${json.char_count} tecken extraherade)` });
    } catch (e) {
      toast({ title: "Fel vid uppladdning", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (loadedFileName) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-v2-violet/30 bg-v2-violet/5">
        <FileText className="h-4 w-4 text-v2-violet shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-v2-ink truncate">{loadedFileName}</div>
          <div className="text-[12px] text-v2-muted">Inläst – AI använder dokumentet som kontext</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCleared} className="text-v2-muted hover:text-destructive">
          <X className="h-4 w-4 mr-1" /> Ta bort
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
        dragOver ? "border-v2-violet bg-v2-violet/5" : "border-v2-line bg-white"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-2">
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-v2-violet" />
            <div className="text-[13px] text-v2-muted">Läser dokumentet med AI…</div>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-v2-muted" />
            <div className="text-[13px] text-v2-ink">
              <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-v2-violet hover:underline">
                Ladda upp ärendet
              </button>{" "}
              eller dra och släpp filen här
            </div>
            <div className="text-[11px] text-v2-muted">PDF, DOCX eller PPTX · max 10 MB</div>
          </>
        )}
      </div>
    </div>
  );
}
