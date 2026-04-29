// Map Supabase auth-fel till i18n-nycklar.
// Vi tittar primärt på error.code (nytt) och faller tillbaka på message-matching.
import type { TFunction } from "i18next";

export function translateAuthError(t: TFunction, err: unknown): string {
  const anyErr = err as { code?: string; message?: string; status?: number } | null | undefined;
  const code = anyErr?.code;
  const msg = (anyErr?.message ?? "").toLowerCase();

  // Code-baserad mappning (Supabase GoTrue v2.x error codes)
  const byCode: Record<string, string> = {
    invalid_credentials: "auth.errors.invalid_credentials",
    email_not_confirmed: "auth.errors.email_not_confirmed",
    user_already_exists: "auth.errors.user_already_exists",
    email_address_invalid: "auth.errors.email_invalid",
    weak_password: "auth.errors.weak_password",
    over_email_send_rate_limit: "auth.errors.rate_limited",
    over_request_rate_limit: "auth.errors.rate_limited",
    same_password: "auth.errors.same_password",
    signup_disabled: "auth.errors.signup_disabled",
    user_not_found: "auth.errors.user_not_found",
  };
  if (code && byCode[code]) return t(byCode[code]) as string;

  // Message-baserad fallback
  if (msg.includes("invalid login")) return t("auth.errors.invalid_credentials") as string;
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return t("auth.errors.user_already_exists") as string;
  if (msg.includes("email not confirmed")) return t("auth.errors.email_not_confirmed") as string;
  if (msg.includes("rate limit") || msg.includes("too many"))
    return t("auth.errors.rate_limited") as string;
  if (msg.includes("password") && msg.includes("short"))
    return t("auth.errors.weak_password") as string;
  if (msg.includes("invalid email")) return t("auth.errors.email_invalid") as string;

  // Sista utväg: visa råmeddelandet om det finns, annars generisk text.
  return anyErr?.message || (t("auth.errors.generic") as string);
}
