// Robust wrapper för Lovable AI Gateway med retry, timeout och fel-klassning.
// Används av edge functions som ringer https://ai.gateway.lovable.dev/v1/chat/completions.
//
// Felklasser (error_kind):
//   rate_limit         — 429 efter alla retries
//   timeout            — AbortError efter TIMEOUT_MS
//   auth               — 401 / 403
//   model_unavailable  — 5xx efter alla retries
//   bad_request        — 400 (returneras direkt utan retry)
//   unknown            — allt annat

// deno-lint-ignore-file no-explicit-any

export interface LLMCallOptions {
  model: string;
  messages: any[];
  tools?: any[];
  tool_choice?: any;
  response_format?: { type: string };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LLMCallExtras {
  /** Per-call timeout override i ms. Default 45000. */
  timeout_ms?: number;
  /** Namn på edge function som anropar — används för analytics. */
  function_name?: string;
  /** Supabase admin-client för att logga llm_call_duration-event. */
  // deno-lint-ignore no-explicit-any
  analyticsClient?: any;
  /** user_id för analytics. */
  user_id?: string;
}

export interface LLMCallResult {
  ok: true;
  data?: any;
  body?: ReadableStream<Uint8Array>;
  duration_ms: number;
  attempts: number;
}

export type LLMErrorKind =
  | "rate_limit"
  | "timeout"
  | "auth"
  | "model_unavailable"
  | "bad_request"
  | "unknown";

export interface LLMCallError {
  ok: false;
  error_kind: LLMErrorKind;
  status?: number;
  message: string;
  duration_ms: number;
  attempts: number;
}

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 800;
export const TIMEOUT_MS = 45000;

export async function callLLM(
  options: LLMCallOptions,
  apiKey: string,
): Promise<LLMCallResult | LLMCallError> {
  const start = Date.now();
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(options),
        signal: controller.signal,
      });
      clearTimeout(timeoutHandle);

      if (response.ok) {
        if (options.stream) {
          return {
            ok: true,
            body: response.body!,
            duration_ms: Date.now() - start,
            attempts: attempt,
          };
        }
        const data = await response.json();
        return { ok: true, data, duration_ms: Date.now() - start, attempts: attempt };
      }

      // Status-baserad felklassning
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error_kind: "auth",
          status: response.status,
          message: "Auth failed",
          duration_ms: Date.now() - start,
          attempts: attempt,
        };
      }

      if (response.status === 400) {
        const errBody = await response.text().catch(() => "");
        return {
          ok: false,
          error_kind: "bad_request",
          status: response.status,
          message: errBody || "Bad request",
          duration_ms: Date.now() - start,
          attempts: attempt,
        };
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : RETRY_BASE_MS * Math.pow(2, attempt - 1);
        if (attempt < RETRY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return {
          ok: false,
          error_kind: "rate_limit",
          status: 429,
          message: "Rate limited",
          duration_ms: Date.now() - start,
          attempts: attempt,
        };
      }

      if (response.status >= 500) {
        if (attempt < RETRY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
          continue;
        }
        return {
          ok: false,
          error_kind: "model_unavailable",
          status: response.status,
          message: "Server error",
          duration_ms: Date.now() - start,
          attempts: attempt,
        };
      }

      lastError = `Status ${response.status}`;
    } catch (err) {
      clearTimeout(timeoutHandle);
      const e = err as { name?: string };
      if (e?.name === "AbortError") {
        if (attempt < RETRY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS));
          continue;
        }
        return {
          ok: false,
          error_kind: "timeout",
          message: "Request timed out",
          duration_ms: Date.now() - start,
          attempts: attempt,
        };
      }
      lastError = err;
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
        continue;
      }
    }
  }

  return {
    ok: false,
    error_kind: "unknown",
    message: String(lastError ?? "Unknown error"),
    duration_ms: Date.now() - start,
    attempts: RETRY_ATTEMPTS,
  };
}

/** Mappa error_kind → kort svensk text för chatten. */
export function userFacingMessage(kind: LLMErrorKind): string {
  switch (kind) {
    case "rate_limit":
      return "Boten är upptagen just nu. Försök igen om en minut.";
    case "timeout":
      return "Det tar längre tid än vanligt. Försök igen — ofta löser det sig.";
    case "auth":
      return "Något strulade. Tryck för att försöka igen.";
    case "bad_request":
      return "Något strulade. Tryck för att försöka igen.";
    case "model_unavailable":
      return "Modellen är överbelastad just nu. Försök igen om en stund.";
    default:
      return "Något strulade. Tryck för att försöka igen.";
  }
}
