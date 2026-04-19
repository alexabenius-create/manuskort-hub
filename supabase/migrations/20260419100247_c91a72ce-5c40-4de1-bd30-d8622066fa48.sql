ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS display_title text,
  ADD COLUMN IF NOT EXISTS display_org text;