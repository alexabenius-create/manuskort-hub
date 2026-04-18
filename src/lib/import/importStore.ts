// Wizard-state — överlever micro-navigering inom /importera.
// Töms vid commit eller "Avbryt".

import { create } from "zustand";
import type { ParsedBlock } from "./parseDocument";
import type { PreviewCard, SplitStrategy, TextSize } from "./splitStrategies";

export interface SpeakerMapping {
  detectedName: string;
  tempId: string;
  action: "new" | "existing" | "ignore";
  existingPanelistId?: string;
  color?: string; // för "new"-display
}

interface ImportState {
  // Steg 1
  file: File | null;
  fileKind: "docx" | "txt" | null;
  rawBlocks: ParsedBlock[];
  detectedTitle: string | null;
  skipped: { images: number; tables: number; footnotes: number };

  // Inställningar
  title: string;
  targetSeconds: number;
  textSize: TextSize;
  strategy: SplitStrategy;
  wordsPerCard: number;

  // Steg 2
  cards: PreviewCard[];
  speakers: SpeakerMapping[];
  speakerTempIds: Map<string, string>;
  dirty: boolean;

  setFile: (f: File | null) => void;
  setFileKind: (k: "docx" | "txt" | null) => void;
  setRawBlocks: (b: ParsedBlock[]) => void;
  setDetectedTitle: (t: string | null) => void;
  setSkipped: (s: { images: number; tables: number; footnotes: number }) => void;

  setTitle: (t: string) => void;
  setTargetSeconds: (s: number) => void;
  setTextSize: (s: TextSize) => void;
  setStrategy: (s: SplitStrategy) => void;
  setWordsPerCard: (n: number) => void;

  setCards: (c: PreviewCard[]) => void;
  setSpeakers: (s: SpeakerMapping[]) => void;
  updateSpeaker: (detectedName: string, patch: Partial<SpeakerMapping>) => void;
  markDirty: () => void;

  reset: () => void;
}

const initial = {
  file: null,
  fileKind: null,
  rawBlocks: [],
  detectedTitle: null,
  skipped: { images: 0, tables: 0, footnotes: 0 },

  title: "",
  targetSeconds: 5 * 60,
  textSize: "md" as TextSize,
  strategy: "wordcount" as SplitStrategy,
  wordsPerCard: 130,

  cards: [],
  speakers: [],
  speakerTempIds: new Map<string, string>(),
  dirty: false,
};

export const useImportStore = create<ImportState>((set) => ({
  ...initial,

  setFile: (f) => set({ file: f }),
  setFileKind: (k) => set({ fileKind: k }),
  setRawBlocks: (b) => set({ rawBlocks: b }),
  setDetectedTitle: (t) => set({ detectedTitle: t }),
  setSkipped: (s) => set({ skipped: s }),

  setTitle: (t) => set({ title: t }),
  setTargetSeconds: (s) => set({ targetSeconds: s }),
  setTextSize: (s) => set({ textSize: s }),
  setStrategy: (s) => set({ strategy: s }),
  setWordsPerCard: (n) => set({ wordsPerCard: n }),

  setCards: (c) => set({ cards: c }),
  setSpeakers: (s) => set({ speakers: s }),
  updateSpeaker: (detectedName, patch) =>
    set((state) => ({
      speakers: state.speakers.map((s) =>
        s.detectedName === detectedName ? { ...s, ...patch } : s
      ),
    })),
  markDirty: () => set({ dirty: true }),

  reset: () =>
    set({
      ...initial,
      speakerTempIds: new Map<string, string>(),
    }),
}));
