ALTER TABLE public.manuscripts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_manuscripts_archived_at
  ON public.manuscripts (archived_at)
  WHERE archived_at IS NULL;