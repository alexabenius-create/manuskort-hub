-- Backfyll: alla manus kopplade till en debatt-tråd får mode = 'debate'
UPDATE public.manuscripts m
SET mode = 'debate'::manuscript_mode
WHERE id IN (
  SELECT manuscript_id FROM public.debate_threads WHERE manuscript_id IS NOT NULL
  UNION
  SELECT manuscript_id FROM public.debate_turns WHERE manuscript_id IS NOT NULL
);