ALTER TABLE public.admin_insights
  ADD COLUMN IF NOT EXISTS linked_user_id uuid,
  ADD COLUMN IF NOT EXISTS linked_thread_id uuid,
  ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_admin_insights_linked_user
  ON public.admin_insights(linked_user_id);