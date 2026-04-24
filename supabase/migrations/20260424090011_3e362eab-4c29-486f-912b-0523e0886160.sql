ALTER TABLE public.admin_insights
  ADD COLUMN IF NOT EXISTS summary_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actions_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brief_notes text NOT NULL DEFAULT '';