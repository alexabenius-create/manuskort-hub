import { useRef, useState, DragEvent } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectFileKind, MAX_FILE_BYTES } from "@/lib/import/parseDocument";

interface Props {
  file: File | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function UploadZone({ file, onFileSelected, onClear, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-2">
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
