-- Create admin_insights table
CREATE TABLE public.admin_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  raw_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'other',
  source_label TEXT,
  theme TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  ai_summary TEXT,
  ai_proposed_actions TEXT,
  ai_brief TEXT,
  my_notes TEXT NOT NULL DEFAULT '',
  related_ids UUID[] NOT NULL DEFAULT '{}',
  implemented_at TIMESTAMP WITH TIME ZONE,
  implementation_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_insights ENABLE ROW LEVEL SECURITY;

-- Validation trigger for source/priority/status (instead of CHECK constraints)
CREATE OR REPLACE FUNCTION public.validate_admin_insight()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source NOT IN ('email','call','dm','own','meeting','other') THEN
    RAISE EXCEPTION 'Invalid source: %', NEW.source;
  END IF;
  IF NEW.priority NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('new','processing','ready','implemented','archived') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_admin_insight
BEFORE INSERT OR UPDATE ON public.admin_insights
FOR EACH ROW EXECUTE FUNCTION public.validate_admin_insight();

-- updated_at trigger
CREATE TRIGGER trg_admin_insights_updated_at
BEFORE UPDATE ON public.admin_insights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies: admins only
CREATE POLICY "admins_select_insights"
ON public.admin_insights
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_insert_insights"
ON public.admin_insights
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

CREATE POLICY "admins_update_insights"
ON public.admin_insights
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_delete_insights"
ON public.admin_insights
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Index for sorting/filtering
CREATE INDEX idx_admin_insights_status ON public.admin_insights(status);
CREATE INDEX idx_admin_insights_created_at ON public.admin_insights(created_at DESC);