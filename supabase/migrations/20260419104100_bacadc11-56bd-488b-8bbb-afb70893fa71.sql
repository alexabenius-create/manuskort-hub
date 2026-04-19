ALTER TABLE public.cards
ADD COLUMN IF NOT EXISTS cues jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cards_cues ON public.cards USING GIN (cues);