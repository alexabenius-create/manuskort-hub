import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import { useEffect, useRef } from "react";
import { PanelistMark } from "@/lib/panelistMark";
import { QuestionToMark } from "@/lib/questionToMark";
import { PauseMarkNode } from "@/lib/pauseNode";
import { countPresentationRows, splitHtmlAtRow, MAX_ROWS_BY_SIZE, type TextSize } from "@/lib/cardLimits";
import { FormatBubbleMenu } from "./FormatBubbleMenu";

export interface SelectionState {
  hasSelection: boolean;
  activePanelistId: string | null;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  size: "sm" | "md" | "lg";
  onEditorReady?: (editor: Editor | null) => void;
  onSelectionChange?: (state: SelectionState) => void;
  maxRows?: number;
  onRowCountChange?: (rows: number) => void;
  onOverflowPaste?: (overflowText: string) => void;
  /** Auto-reflow vid skrivning: överskott (HTML) skickas till nästa kort.
   *  caretInOverflow=true → caret ska följa med dit. */
  onOverflow?: (overflowHtml: string, caretInOverflow: boolean) => void;
  /** Pull-back vid Backspace i början av kortet: drar tillbaka text från
   *  nuvarande kort upp till föregående kort (om plats finns). */
  onPullBack?: () => void;
}

// Editorns textruta speglar presentationsgeometrin (75ch, font-display,
// line-height 1.7). Då matchar "X rader" exakt det presentationsläget visar.
// Värden här ska följa PRESENTATION_GEOMETRY i src/lib/cardLimits.ts.
const sizeClass = {
  sm: "font-display text-[24px] leading-[1.7] max-w-[75ch] min-h-[90px]",
  md: "font-display text-[30px] leading-[1.7] max-w-[75ch] min-h-[120px]",
  lg: "font-display text-[38px] leading-[1.7] max-w-[75ch] min-h-[150px]",
};

export function TiptapEditor({
  value,
  onChange,
  placeholder,
  size,
  onEditorReady,
  onSelectionChange,
  maxRows,
  onRowCountChange,
  onOverflowPaste,
  onOverflow,
  onPullBack,
}: Props) {
  // Ref till senaste rad-räkning så handleKeyDown alltid läser färskt värde
  const rowsRef = useRef(0);
  const maxRowsRef = useRef<number | undefined>(maxRows);
  maxRowsRef.current = maxRows;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const onOverflowRef = useRef(onOverflow);
  onOverflowRef.current = onOverflow;
  const onPullBackRef = useRef(onPullBack);
  onPullBackRef.current = onPullBack;
  // Skydd mot rekursiv reflow (när vi själva sätter content efter split)
  const reflowingRef = useRef(false);

  const measureAndReport = (editor: Editor) => {
    // Mät mot presentations-geometrin, INTE editorns egen DOM.
    // Detta säkerställer att "X/Y rader" stämmer med presentationsläget
    // även om editorn har en smalare/bredare textruta.
    const rows = countPresentationRows(editor.getHTML(), sizeRef.current);
    rowsRef.current = rows;
    onRowCountChange?.(rows);
  };

  /** Auto-reflow: om innehållet överstiger maxRows → splitta och skicka
   *  överskott uppåt via onOverflow. Caret följer med om användaren skrev
   *  i den del som flyttades. */
  const maybeReflow = (editor: Editor) => {
    const cb = onOverflowRef.current;
    const max = maxRowsRef.current;
    if (!cb || !max || reflowingRef.current) return;
    const html = editor.getHTML();
    const rows = countPresentationRows(html, sizeRef.current);
    if (rows <= max) return;

    const [fits, overflow] = splitHtmlAtRow(html, max, sizeRef.current);
    if (!overflow || !overflow.trim() || fits === html) return;

    // Beräkna om caret hamnade i overflow-delen.
    // Heuristik: om caret-position i doc:en är större än textlängden av "fits",
    // så skrev användaren i den del som flyttas → följ med.
    const tmp = document.createElement("div");
    tmp.innerHTML = fits;
    const fitsTextLen = (tmp.textContent ?? "").length;
    const caretPos = editor.state.selection.from;
    // ProseMirror-pos räknar noder/tokens — inte exakt textindex. Vi
    // approximerar: jämför med totala docs textstorlek.
    tmp.innerHTML = html;
    const totalTextLen = (tmp.textContent ?? "").length;
    const caretRatio = totalTextLen > 0 ? caretPos / editor.state.doc.content.size : 1;
    const caretInOverflow = caretRatio * totalTextLen >= fitsTextLen - 1;

    reflowingRef.current = true;
    try {
      editor.commands.setContent(fits, { emitUpdate: false });
      onChange(fits);
      rowsRef.current = countPresentationRows(fits, sizeRef.current);
      onRowCountChange?.(rowsRef.current);
      cb(overflow, caretInOverflow);
    } finally {
      // Släpp i nästa tick så vi inte triggar oss själva
      requestAnimationFrame(() => { reflowingRef.current = false; });
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Blockquote,
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      PanelistMark,
      QuestionToMark,
      PauseMarkNode,
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      // Mät i nästa frame så DOM hinner uppdateras, kör sedan ev. auto-reflow
      requestAnimationFrame(() => {
        measureAndReport(editor);
        maybeReflow(editor);
      });
    },
    onCreate: ({ editor }) => {
      requestAnimationFrame(() => measureAndReport(editor));
    },
    onSelectionUpdate: ({ editor }) => {
      if (!onSelectionChange) return;
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      const attrs = editor.getAttributes("panelist");
      onSelectionChange({
        hasSelection,
        activePanelistId: (attrs?.panelistId as string) ?? null,
      });
    },
    onFocus: ({ editor }) => {
      if (!onSelectionChange) return;
      const { from, to } = editor.state.selection;
      const attrs = editor.getAttributes("panelist");
      onSelectionChange({
        hasSelection: from !== to,
        activePanelistId: (attrs?.panelistId as string) ?? null,
      });
    },
    editorProps: {
      attributes: {
        class: `${sizeClass[size]} focus:outline-none w-full text-foreground`,
      },
      handleKeyDown: (view, event) => {
        // "/" → infoga paus (alltid tillåtet, även över gräns)
        if (event.key === "/" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          editor?.chain().focus().insertPause().run();
          return true;
        }
        // Backspace vid doc-start → pull-back från föregående kort.
        // Endast utan modifier-tangenter och utan markering.
        if (
          event.key === "Backspace" &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          onPullBackRef.current
        ) {
          const sel = view.state.selection;
          // ProseMirror: doc-start är pos 1 (pos 0 är före första noden).
          // Vi triggar om caret är vid pos 1 OCH det inte finns markering.
          if (sel.empty && sel.from <= 1) {
            event.preventDefault();
            onPullBackRef.current();
            return true;
          }
        }
        // Inmatning är alltid tillåten — överskott visas som varning, inte spärr.
        return false;
      },
      handlePaste: (view, event) => {
        const max = maxRowsRef.current;
        if (!max) return false;

        const text = event.clipboardData?.getData("text/plain");
        if (!text) return false;

        // Mät en testrad — uppskatta tecken per visuell rad genom DOM-bredd
        const dom = view.dom as HTMLElement;
        const cs = getComputedStyle(dom);
        const lh = parseFloat(cs.lineHeight) || 24;
        const availableRows = Math.max(0, max - rowsRef.current);

        if (availableRows <= 0) {
          // Inget utrymme alls → skicka allt till nästa kort
          event.preventDefault();
          onOverflowPaste?.(text);
          return true;
        }

        // Sätt in allt först — om det överskrider, dela upp
        // Strategi: sätt in hela texten, mät, om över max → trunkera och skicka resten
        event.preventDefault();

        const insertAndMeasure = (chunk: string): number => {
          editor?.chain().focus().insertContent(chunk.replace(/\n/g, "<br>")).run();
          // Mät mot presentationsgeometrin (inte editorns DOM)
          return countPresentationRows(editor?.getHTML() ?? "", sizeRef.current);
        };

        // Försök sätt in allt
        const beforeRows = rowsRef.current;
        const rowsAfter = insertAndMeasure(text);
        rowsRef.current = rowsAfter;
        onRowCountChange?.(rowsAfter);

        if (rowsAfter <= max) return true;

        // Över gränsen → ångra och dela upp manuellt tecken-för-tecken
        editor?.chain().focus().undo().run();
        rowsRef.current = beforeRows;
        onRowCountChange?.(beforeRows);

        // Binärsök fram största prefix som ryms
        let lo = 0;
        let hi = text.length;
        let bestFit = 0;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const chunk = text.slice(0, mid);
          editor?.chain().focus().insertContent(chunk.replace(/\n/g, "<br>")).run();
          const r = countPresentationRows(editor?.getHTML() ?? "", sizeRef.current);
          editor?.chain().focus().undo().run();
          if (r <= max) {
            bestFit = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }

        // Sätt in det som ryms
        if (bestFit > 0) {
          const fitText = text.slice(0, bestFit);
          editor?.chain().focus().insertContent(fitText.replace(/\n/g, "<br>")).run();
          requestAnimationFrame(() => editor && measureAndReport(editor));
        }

        // Skicka överskottet till nytt kort
        const overflow = text.slice(bestFit).trimStart();
        if (overflow.length > 0) {
          onOverflowPaste?.(overflow);
        }
        return true;
      },
    },
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find((e) => e.name === "placeholder");
    if (ext) {
      ext.options.placeholder = placeholder;
      editor.view.dispatch(editor.state.tr);
    }
  }, [placeholder, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
    requestAnimationFrame(() => measureAndReport(editor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Mät om när storleken ändras (font-size påverkar wrappning)
  useEffect(() => {
    if (!editor) return;
    requestAnimationFrame(() => measureAndReport(editor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, editor]);

  return (
    <>
      <EditorContent editor={editor} />
      <FormatBubbleMenu editor={editor} />
    </>
  );
}
