-- =============================================================
-- Debatt-buddy v2: trådbaserade debattsessioner
-- =============================================================

-- 1. Rensa bort gamla tabeller och referenser
ALTER TABLE public.manuscripts DROP COLUMN IF EXISTS debate_session_id;
DROP TABLE IF EXISTS public.debate_sessions CASCADE;

-- 2. Skapa debate_threads
CREATE TABLE public.debate_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Ny debatt',
  topic_area text NOT NULL DEFAULT '',
  issue_text text NOT NULL DEFAULT '',
  issue_document_text text NOT NULL DEFAULT '',
  issue_document_filename text,
  own_position text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_debate_threads_user_updated
  ON public.debate_threads (user_id, updated_at DESC);

ALTER TABLE public.debate_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debate_threads_select_own"
  ON public.debate_threads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "debate_threads_insert_own"
  ON public.debate_threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debate_threads_update_own"
  ON public.debate_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "debate_threads_delete_own"
  ON public.debate_threads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins_select_all_debate_threads"
  ON public.debate_threads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Skapa debate_turns
CREATE TABLE public.debate_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.debate_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('own_speech','opponent_input','own_reply')),
  opponent_input_mode text CHECK (opponent_input_mode IN ('structured','freeform')) DEFAULT 'structured',
  source_text text NOT NULL DEFAULT '',
  ai_output_text text NOT NULL DEFAULT '',
  ai_card_split jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_rationale text NOT NULL DEFAULT '',
  max_length_percent int NOT NULL DEFAULT 100,
  manuscript_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_debate_turns_thread_position
  ON public.debate_turns (thread_id, position);

ALTER TABLE public.debate_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debate_turns_select_own"
  ON public.debate_turns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "debate_turns_insert_own"
  ON public.debate_turns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debate_turns_update_own"
  ON public.debate_turns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "debate_turns_delete_own"
  ON public.debate_turns FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins_select_all_debate_turns"
  ON public.debate_turns FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Triggers för updated_at
CREATE TRIGGER update_debate_threads_updated_at
  BEFORE UPDATE ON public.debate_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_debate_turns_updated_at
  BEFORE UPDATE ON public.debate_turns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Trigger som bumpar thread.updated_at vid förändring av en turn
CREATE OR REPLACE FUNCTION public.bump_debate_thread_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.debate_threads SET updated_at = now() WHERE id = OLD.thread_id;
    RETURN OLD;
  ELSE
    UPDATE public.debate_threads SET updated_at = now() WHERE id = NEW.thread_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER bump_thread_on_turn_change
  AFTER INSERT OR UPDATE OR DELETE ON public.debate_turns
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_debate_thread_updated_at();