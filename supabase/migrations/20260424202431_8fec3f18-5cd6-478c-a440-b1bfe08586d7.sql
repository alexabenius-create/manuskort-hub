ALTER TABLE public.cards
  ALTER COLUMN section_label SET DEFAULT '',
  ALTER COLUMN section_label DROP NOT NULL;