import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef } from "react";
import { PanelistMark } from "@/lib/panelistMark";
import { countPresentationRows } from "@/lib/cardLimits";

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
}

const sizeClass = {
  sm: "text-[16px] leading-[1.6] min-h-[90px]",
  md: "text-[18px] leading-[1.6] min-h-[120px]",
  lg: "text-[22px] leading-[1.55] min-h-[150px]",
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
}: Props) {
  // Ref till senaste rad-räkning så handleKeyDown alltid läser färskt värde
  const rowsRef = useRef(0);
  const maxRowsRef = useRef<number | undefined>(maxRows);
  maxRowsRef.current = maxRows;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const measureAndReport = (editor: Editor) => {
    // Mät mot presentations-geometrin, INTE editorns egen DOM.
    // Detta säkerställer att "X/Y rader" stämmer med presentationsläget
    // även om editorn har en smalare/bredare textruta.
    const rows = countPresentationRows(editor.getHTML(), sizeRef.current);
    rowsRef.current = rows;
    onRowCountChange?.(rows);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Underline,
      Highlight,
      PanelistMark,
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      // Mät i nästa frame så DOM hinner uppdateras
      requestAnimationFrame(() => measureAndReport(editor));
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
        class: `font-sans ${sizeClass[size]} focus:outline-none w-full text-foreground`,
      },
      handleKeyDown: (_view, event) => {
        // "/" → infoga paus (alltid tillåtet, även över gräns)
        if (event.key === "/" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          editor?.chain().focus().insertContent('<span class="pause-mark">paus</span>&nbsp;').run();
          return true;
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
          // Synkron mätning direkt efter insert
          return countVisualRows(dom);
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
          const r = countVisualRows(dom);
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

  return <EditorContent editor={editor} />;
}
