/**
 * CardBlockNodeView — vanilla TS NodeView som renderar v1:s kort-look runt
 * en cardBlock-nod i ProseMirror-dokumentet.
 *
 * DOM-struktur:
 *   <article class="card-block">
 *     <header class="card-chrome-header">…meta…</header>
 *     <div   class="card-content"  data-content-dom>  ← contentDOM (PM:s)
 *     <footer class="card-chrome-footer">…cues + notes…</footer>
 *   </article>
 *
 * Klick på contentDOM hanteras av ProseMirror naturligt. Header och footer
 * ligger UTANFÖR contentDOM så de stör inte caret/text. Inga overlays.
 */
import type { NodeViewConstructor } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import type { Decoration } from "prosemirror-view";
import type { Editor } from "@tiptap/core";
import { wordCount, estimateSeconds, formatDuration } from "@/lib/wordCount";
import type { Cue } from "@/lib/cues";

type Args = Parameters<NodeViewConstructor>[0] extends never
  ? never
  : {
      node: PMNode;
      editor: Editor;
      getPos: () => number | undefined;
      decorations: readonly Decoration[];
      innerDecorations: unknown;
      HTMLAttributes: Record<string, unknown>;
      extension: unknown;
    };

export class CardBlockNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private headerEl: HTMLElement;
  private footerEl: HTMLElement;
  private node: PMNode;

  constructor(props: Args) {
    this.node = props.node;

    // Wrapper — v1:s kort-box
    this.dom = document.createElement("article");
    this.dom.dataset.cardBlock = "true";
    this.dom.className = [
      "card-block",
      "relative",
      "rounded-2xl",
      "border",
      "border-border/40",
      "bg-surface",
      "shadow-subtle",
      "mb-4",
      "transition-colors",
    ].join(" ");

    this.headerEl = document.createElement("header");
    this.headerEl.className = "card-chrome-header";

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "card-content px-5 sm:px-6 py-3";

    this.footerEl = document.createElement("footer");
    this.footerEl.className = "card-chrome-footer";

    this.dom.append(this.headerEl, this.contentDOM, this.footerEl);

    this.renderChrome();
  }

  /** Re-render chrome när attrs ändras (men rör ALDRIG contentDOM). */
  update(node: PMNode): boolean {
    if (node.type.name !== "cardBlock") return false;
    this.node = node;
    this.renderChrome();
    return true;
  }

  /**
   * Hindra ProseMirror från att äta klick på chrome-knappar. Returnera true
   * = "PM ska ignorera detta event". Vi gör det för klick UTANFÖR contentDOM.
   */
  ignoreMutation(mutation: MutationRecord): boolean {
    if (
      mutation.type === "childList" &&
      (mutation.target === this.headerEl ||
        mutation.target === this.footerEl ||
        this.headerEl.contains(mutation.target as Node) ||
        this.footerEl.contains(mutation.target as Node))
    ) {
      return true;
    }
    if (
      mutation.type === "attributes" &&
      (mutation.target === this.headerEl ||
        mutation.target === this.footerEl ||
        this.headerEl.contains(mutation.target as Node) ||
        this.footerEl.contains(mutation.target as Node))
    ) {
      return true;
    }
    return false;
  }

  stopEvent(event: Event): boolean {
    const target = event.target as Node | null;
    if (!target) return false;
    if (this.headerEl.contains(target) || this.footerEl.contains(target)) {
      return true;
    }
    return false;
  }

  destroy(): void {
    this.headerEl.replaceChildren();
    this.footerEl.replaceChildren();
  }

  // ============== Render helpers ==============

  private renderChrome() {
    this.renderHeader();
    this.renderFooter();
    // Aktiv-ring vid panic
    this.dom.classList.toggle("ring-1", !!this.node.attrs.isPanic);
    this.dom.classList.toggle("ring-[hsl(35_85%_50%)]/40", !!this.node.attrs.isPanic);
  }

  private renderHeader() {
    const a = this.node.attrs as {
      cardNumber: number;
      totalCards: number;
      isPanic: boolean;
      wpm: number;
    };
    const html = this.node.textBetween(0, this.node.content.size, " ", " ");
    // Använd hela kortets text för word count
    const words = wordCount(`<p>${html}</p>`);
    const seconds = estimateSeconds(words, a.wpm || 140);

    const num = String(a.cardNumber).padStart(2, "0");
    const total = a.totalCards;

    this.headerEl.className =
      "px-5 sm:px-6 pt-3 pb-1 flex items-center gap-2 flex-wrap text-[12px] font-mono text-muted-foreground border-b border-border/30";

    this.headerEl.innerHTML = `
      <span class="px-1 tracking-wide">Kort ${num} / ${total}</span>
      <span class="opacity-40">·</span>
      <span class="tabular-nums">${words} ord</span>
      <span class="opacity-40">·</span>
      <span class="tabular-nums">${formatDuration(seconds)}</span>
      ${
        a.isPanic
          ? `<span class="opacity-40">·</span>
             <span class="inline-flex items-center gap-1 text-[hsl(35_85%_38%)]">
               <span class="text-[11px] uppercase tracking-wider">panik</span>
             </span>`
          : ""
      }
      <div class="ml-auto flex items-center gap-1 opacity-50" aria-hidden="true">
        <span title="Drag inaktiverad i Fas 1" class="cursor-not-allowed select-none text-muted-foreground/60">⋮⋮</span>
        <span title="Meny — kommer i Fas 2" class="cursor-not-allowed select-none text-muted-foreground/60">⋯</span>
      </div>
    `;
  }

  private renderFooter() {
    const cues = (this.node.attrs.cues ?? []) as Cue[];
    const notes = (this.node.attrs.notes ?? "").trim();
    const showNotes = this.node.attrs.showNotes !== false;

    const hasCues = cues.length > 0;
    const hasNotes = showNotes && notes.length > 0;

    if (!hasCues && !hasNotes) {
      this.footerEl.className = "";
      this.footerEl.replaceChildren();
      return;
    }

    this.footerEl.className =
      "px-5 sm:px-6 pb-3 pt-2 border-t border-border/30 flex flex-col gap-2";

    const chips = hasCues
      ? `<div class="flex gap-1.5 flex-wrap items-center">
           ${cues
             .map((c) => {
               const label =
                 c.kind === "energy"
                   ? "⚡"
                   : c.kind === "action"
                   ? "▶"
                   : c.kind === "panel"
                   ? "👤"
                   : "⏱";
               const text = escapeHtml(c.text || "");
               return `<span class="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-surface-2 text-[11px] text-muted-foreground border border-border/40">
                 <span aria-hidden="true">${label}</span>
                 <span>${text}</span>
               </span>`;
             })
             .join("")}
         </div>`
      : "";

    const notesEl = hasNotes
      ? `<div class="text-[12px] text-muted-foreground border-l-2 border-border/50 pl-2 whitespace-pre-wrap">${escapeHtml(notes)}</div>`
      : "";

    this.footerEl.innerHTML = chips + notesEl;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
