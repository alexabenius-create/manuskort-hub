-- Cutover: lägg till editor-preference på profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'editor_version') THEN
    CREATE TYPE public.editor_version AS ENUM ('v1', 'v3');
  END IF;
END$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS editor_preference public.editor_version NOT NULL DEFAULT 'v3';