-- Add section grouping to cards
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS section_id uuid,
  ADD COLUMN IF NOT EXISTS section_label text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS cards_manuscript_section_idx
  ON public.cards (manuscript_id, section_id);

-- Backfill: every existing manuscript gets a single section labeled "Anförande"
DO $$
DECLARE
  m record;
  new_section uuid;
BEGIN
  FOR m IN
    SELECT DISTINCT manuscript_id
    FROM public.cards
    WHERE section_id IS NULL
  LOOP
    new_section := gen_random_uuid();
    UPDATE public.cards
      SET section_id = new_section,
          section_label = CASE WHEN section_label = '' THEN 'Anförande' ELSE section_label END
      WHERE manuscript_id = m.manuscript_id
        AND section_id IS NULL;
  END LOOP;
END $$;