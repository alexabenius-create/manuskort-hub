CREATE TABLE public.panelists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manuscript_id UUID NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#F5D76E',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_panelists_manuscript ON public.panelists(manuscript_id);

ALTER TABLE public.panelists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "panelists_select_own" ON public.panelists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "panelists_insert_own" ON public.panelists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "panelists_update_own" ON public.panelists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "panelists_delete_own" ON public.panelists
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_panelists_updated_at
BEFORE UPDATE ON public.panelists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();