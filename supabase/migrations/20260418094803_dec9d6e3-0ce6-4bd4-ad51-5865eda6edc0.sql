ALTER TABLE public.manuscripts ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER;

ALTER TABLE public.manuscripts DROP COLUMN IF EXISTS shortcut_1_card_id;
ALTER TABLE public.manuscripts DROP COLUMN IF EXISTS shortcut_2_card_id;

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS is_panic_card BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cards_panic
  ON public.cards (manuscript_id, position)
  WHERE is_panic_card = true;