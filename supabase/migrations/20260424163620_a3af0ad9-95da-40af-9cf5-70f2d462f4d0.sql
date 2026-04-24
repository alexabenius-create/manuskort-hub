-- Add user_role to threads
ALTER TABLE public.debate_threads
  ADD COLUMN IF NOT EXISTS user_role text NOT NULL DEFAULT 'speaker';

-- Add new columns to debate_turns
ALTER TABLE public.debate_turns
  ADD COLUMN IF NOT EXISTS parent_turn_id uuid,
  ADD COLUMN IF NOT EXISTS speaker_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS round_number int NOT NULL DEFAULT 1;

-- Drop the old CHECK constraint on kind (if any) and recreate with new values
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.debate_turns'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%kind%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.debate_turns DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.debate_turns
  ADD CONSTRAINT debate_turns_kind_check
  CHECK (kind IN ('own_speech','opponent_input','own_reply','opponent_speech','reply','rebuttal','rebuttal_waived'));

-- Index for grouping replies under a parent
CREATE INDEX IF NOT EXISTS debate_turns_parent_idx
  ON public.debate_turns (thread_id, parent_turn_id);

CREATE INDEX IF NOT EXISTS debate_turns_round_idx
  ON public.debate_turns (thread_id, round_number, position);
