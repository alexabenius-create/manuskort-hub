CREATE POLICY "admins_insert_threads"
ON public.feedback_threads
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));