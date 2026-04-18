ALTER TABLE public.manuscripts
ADD COLUMN IF NOT EXISTS time_format text NOT NULL DEFAULT 'elapsed'
CHECK (time_format IN ('clock', 'elapsed'));