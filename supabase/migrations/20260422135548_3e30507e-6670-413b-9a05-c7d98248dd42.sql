-- Feedback threads
CREATE TABLE public.feedback_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  subject text NOT NULL,
  source text NOT NULL CHECK (source IN ('landing','library','editor')),
  manuscript_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_threads_user ON public.feedback_threads(user_id);
CREATE INDEX idx_feedback_threads_updated ON public.feedback_threads(updated_at DESC);

-- Feedback messages
CREATE TABLE public.feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.feedback_threads(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  sender_user_id uuid,
  body text NOT NULL,
  read_by_user boolean NOT NULL DEFAULT false,
  read_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_messages_thread ON public.feedback_messages(thread_id, created_at);
CREATE INDEX idx_feedback_messages_unread_admin ON public.feedback_messages(read_by_admin) WHERE read_by_admin = false;
CREATE INDEX idx_feedback_messages_unread_user ON public.feedback_messages(read_by_user) WHERE read_by_user = false;

-- Bumps thread updated_at when a new message arrives
CREATE OR REPLACE FUNCTION public.touch_feedback_thread()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.feedback_threads
  SET updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_feedback_thread
AFTER INSERT ON public.feedback_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_feedback_thread();

CREATE TRIGGER trg_feedback_threads_updated_at
BEFORE UPDATE ON public.feedback_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- ===== feedback_threads policies =====

-- Users see their own threads
CREATE POLICY "users_select_own_threads"
ON public.feedback_threads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins see all
CREATE POLICY "admins_select_all_threads"
ON public.feedback_threads FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users insert their own threads
CREATE POLICY "users_insert_own_threads"
ON public.feedback_threads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Anonymous landing-page submissions: no user_id, source='landing', email required
CREATE POLICY "anon_insert_landing_threads"
ON public.feedback_threads FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND source = 'landing'
  AND email IS NOT NULL
  AND length(email) > 3
);

-- Admins can update threads (e.g. close)
CREATE POLICY "admins_update_threads"
ON public.feedback_threads FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ===== feedback_messages policies =====

-- Users see messages in their own threads
CREATE POLICY "users_select_own_messages"
ON public.feedback_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feedback_threads t
    WHERE t.id = feedback_messages.thread_id
      AND t.user_id = auth.uid()
  )
);

-- Admins see all
CREATE POLICY "admins_select_all_messages"
ON public.feedback_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users insert messages in their own threads as 'user'
CREATE POLICY "users_insert_own_messages"
ON public.feedback_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_role = 'user'
  AND sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.feedback_threads t
    WHERE t.id = thread_id
      AND t.user_id = auth.uid()
  )
);

-- Anonymous: insert first message in a landing thread
CREATE POLICY "anon_insert_landing_messages"
ON public.feedback_messages FOR INSERT
TO anon
WITH CHECK (
  sender_role = 'user'
  AND sender_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.feedback_threads t
    WHERE t.id = thread_id
      AND t.user_id IS NULL
      AND t.source = 'landing'
  )
);

-- Admins insert reply messages
CREATE POLICY "admins_insert_messages"
ON public.feedback_messages FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND sender_role = 'admin'
  AND sender_user_id = auth.uid()
);

-- Users update read_by_user on messages in their threads
CREATE POLICY "users_update_own_messages_read"
ON public.feedback_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feedback_threads t
    WHERE t.id = feedback_messages.thread_id
      AND t.user_id = auth.uid()
  )
);

-- Admins update messages (read_by_admin)
CREATE POLICY "admins_update_messages"
ON public.feedback_messages FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_threads;