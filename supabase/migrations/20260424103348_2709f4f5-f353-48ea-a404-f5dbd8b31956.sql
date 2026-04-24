ALTER TABLE public.feedback_threads DROP CONSTRAINT feedback_threads_source_check;
ALTER TABLE public.feedback_threads ADD CONSTRAINT feedback_threads_source_check
  CHECK (source = ANY (ARRAY['landing'::text, 'library'::text, 'editor'::text, 'insight'::text, 'admin'::text]));