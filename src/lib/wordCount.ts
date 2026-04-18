// Räknar ord i HTML-text (Tiptap content_html) och uppskattar talad tid.
export function stripHtml(html: string): string {
  if (!html) return "";
  // Ta bort taggar, behåll mellanrum
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(html: string): number {
  const text = stripHtml(html);
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export function estimateSeconds(words: number, wpm = 140): number {
  if (!words) return 0;
  return Math.round((words / wpm) * 60);
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
