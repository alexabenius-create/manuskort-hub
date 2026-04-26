// Extraherar text från PDF / DOCX / TXT klient-sidan.
// Används av Snabbstart för att bifoga underlag som extra kontext.
// GDPR: filen sparas aldrig — bara extraherad text skickas vidare och bara
// kopplas till en specifik debate_thread (försvinner när tråden raderas).

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTS = [".pdf", ".docx", ".txt"] as const;

export function isAllowedFile(file: File): boolean {
  if (file.size > MAX_FILE_BYTES) return false;
  const lower = file.name.toLowerCase();
  return ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
}

export function fileExtension(file: File): "pdf" | "docx" | "txt" | "other" {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || file.type === "text/plain") return "txt";
  return "other";
}

export async function extractDocumentText(file: File): Promise<string> {
  const ext = fileExtension(file);

  if (ext === "txt") {
    return await file.text();
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || "";
  }

  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    // Worker via CDN — undviker bundler-konfig
    // deno-lint-ignore no-explicit-any
    (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // deno-lint-ignore no-explicit-any
      text += content.items.map((item: any) => item.str || "").join(" ") + "\n";
    }
    return text;
  }

  throw new Error("Unsupported file type");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
