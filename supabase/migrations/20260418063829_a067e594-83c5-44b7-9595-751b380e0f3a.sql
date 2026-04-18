
-- Manuskort schema: manuscripts + cards
-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.manuscript_mode AS ENUM ('moderator', 'speaker');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_role AS ENUM ('moderator', 'speaker');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- updated_at helper (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- manuscripts
CREATE TABLE IF NOT EXISTS public.manuscripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nytt manus',
  mode public.manuscript_mode NOT NULL DEFAULT 'speaker',
  tags TEXT[] NOT NULL DEFAULT '{}',
  text_size TEXT NOT NULL DEFAULT 'md', -- sm | md | lg
  show_notes BOOLEAN NOT NULL DEFAULT true,
  show_times BOOLEAN NOT NULL DEFAULT true,
  wpm INTEGER NOT NULL DEFAULT 140,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manuscripts_user ON public.manuscripts(user_id, updated_at DESC);

ALTER TABLE public.manuscripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manuscripts_select_own" ON public.manuscripts;
CREATE POLICY "manuscripts_select_own" ON public.manuscripts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "manuscripts_insert_own" ON public.manuscripts;
CREATE POLICY "manuscripts_insert_own" ON public.manuscripts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "manuscripts_update_own" ON public.manuscripts;
CREATE POLICY "manuscripts_update_own" ON public.manuscripts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "manuscripts_delete_own" ON public.manuscripts;
CREATE POLICY "manuscripts_delete_own" ON public.manuscripts FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_manuscripts_updated_at ON public.manuscripts;
CREATE TRIGGER trg_manuscripts_updated_at
  BEFORE UPDATE ON public.manuscripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cards
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manuscript_id UUID NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  role public.card_role NOT NULL DEFAULT 'speaker',
  title TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  cue_red TEXT NOT NULL DEFAULT '',
  cue_amber TEXT NOT NULL DEFAULT '',
  cue_teal TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_manuscript_position ON public.cards(manuscript_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_user ON public.cards(user_id);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cards_select_own" ON public.cards;
CREATE POLICY "cards_select_own" ON public.cards FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cards_insert_own" ON public.cards;
CREATE POLICY "cards_insert_own" ON public.cards FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cards_update_own" ON public.cards;
CREATE POLICY "cards_update_own" ON public.cards FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cards_delete_own" ON public.cards;
CREATE POLICY "cards_delete_own" ON public.cards FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_cards_updated_at ON public.cards;
CREATE TRIGGER trg_cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
