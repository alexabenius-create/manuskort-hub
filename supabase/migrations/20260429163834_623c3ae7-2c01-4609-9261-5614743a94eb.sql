
-- Tabell för manuella översättningsöverrides (per nyckel + språk)
CREATE TABLE public.translation_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  language text NOT NULL,
  source_text text NOT NULL DEFAULT '',
  source_text_at_override text NOT NULL DEFAULT '',
  value text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, language)
);

CREATE INDEX idx_translation_overrides_lang ON public.translation_overrides(language);

ALTER TABLE public.translation_overrides ENABLE ROW LEVEL SECURITY;

-- Alla får läsa (även anon) så översättningar kan laddas på publika sidor
CREATE POLICY "translation_overrides_select_all"
  ON public.translation_overrides FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "translation_overrides_admin_insert"
  ON public.translation_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND updated_by = auth.uid());

CREATE POLICY "translation_overrides_admin_update"
  ON public.translation_overrides FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND updated_by = auth.uid());

CREATE POLICY "translation_overrides_admin_delete"
  ON public.translation_overrides FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Audit-historik
CREATE TABLE public.translation_override_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  language text NOT NULL,
  old_value text,
  new_value text,
  source_text text,
  action text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_translation_history_key ON public.translation_override_history(key, language);
CREATE INDEX idx_translation_history_changed_at ON public.translation_override_history(changed_at DESC);

ALTER TABLE public.translation_override_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translation_history_admin_select"
  ON public.translation_override_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger som loggar varje ändring i historiken
CREATE OR REPLACE FUNCTION public.log_translation_override_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.translation_override_history (key, language, old_value, new_value, source_text, action, changed_by)
    VALUES (NEW.key, NEW.language, NULL, NEW.value, NEW.source_text, 'create', NEW.updated_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO public.translation_override_history (key, language, old_value, new_value, source_text, action, changed_by)
      VALUES (NEW.key, NEW.language, OLD.value, NEW.value, NEW.source_text, 'update', NEW.updated_by);
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.translation_override_history (key, language, old_value, new_value, source_text, action, changed_by)
    VALUES (OLD.key, OLD.language, OLD.value, NULL, OLD.source_text, 'revert', auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_translation_override_audit
  BEFORE INSERT OR UPDATE ON public.translation_overrides
  FOR EACH ROW EXECUTE FUNCTION public.log_translation_override_change();

CREATE TRIGGER trg_translation_override_audit_delete
  AFTER DELETE ON public.translation_overrides
  FOR EACH ROW EXECUTE FUNCTION public.log_translation_override_change();
