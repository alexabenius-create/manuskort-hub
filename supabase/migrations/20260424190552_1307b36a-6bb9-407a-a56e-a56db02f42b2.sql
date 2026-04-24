-- Lägg till fält i debate_threads
ALTER TABLE public.debate_threads
  ADD COLUMN IF NOT EXISTS manuscript_id uuid,
  ADD COLUMN IF NOT EXISTS bot_state jsonb NOT NULL DEFAULT '{"phase":"intake_issue"}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_opponent_label text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_debate_threads_manuscript ON public.debate_threads(manuscript_id);

-- Ny tabell för chatmeddelanden
CREATE TABLE IF NOT EXISTS public.debate_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.debate_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debate_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select_own" ON public.debate_chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "chat_insert_own" ON public.debate_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins_select_all_chat" ON public.debate_chat_messages
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_debate_chat_thread ON public.debate_chat_messages(thread_id, created_at);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_chat_messages;
ALTER TABLE public.debate_chat_messages REPLICA IDENTITY FULL;