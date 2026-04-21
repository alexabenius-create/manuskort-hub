-- Tillåt att subscription-rader behålls anonymt efter kontoradering.
-- Vi gör user_id nullable och tar bort ev. CASCADE-koppling till auth.users
-- så att radering av kontot inte tar bort betalningshistoriken.

ALTER TABLE public.subscriptions
  ALTER COLUMN user_id DROP NOT NULL;

-- Säkerställ att RLS-policyn för select fungerar även när user_id är null
-- (auth.uid() = null returnerar NULL, så raderna blir osynliga för alla
-- icke-admin användare automatiskt — det är önskat beteendet).
