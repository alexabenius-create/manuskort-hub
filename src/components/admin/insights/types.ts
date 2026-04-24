export type InsightStatus = "new" | "processing" | "ready" | "implemented" | "archived";
export type InsightPriority = "low" | "medium" | "high";
export type InsightSource = "email" | "call" | "dm" | "own" | "meeting" | "other";

export interface Insight {
  id: string;
  user_id: string;
  raw_text: string;
  source: InsightSource;
  source_label: string | null;
  theme: string | null;
  priority: InsightPriority;
  status: InsightStatus;
  ai_summary: string | null;
  ai_proposed_actions: string | null;
  ai_brief: string | null;
  my_notes: string;
  related_ids: string[];
  implemented_at: string | null;
  implementation_ref: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABEL: Record<InsightStatus, string> = {
  new: "Ny",
  processing: "Bearbetas",
  ready: "Klar för bygge",
  implemented: "Implementerad",
  archived: "Arkiverad",
};

export const PRIORITY_LABEL: Record<InsightPriority, string> = {
  low: "Låg",
  medium: "Med",
  high: "Hög",
};

export const SOURCE_LABEL: Record<InsightSource, string> = {
  email: "Mejl",
  call: "Samtal",
  dm: "DM",
  own: "Eget",
  meeting: "Möte",
  other: "Övrigt",
};
