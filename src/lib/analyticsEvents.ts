/**
 * GDPR-REGEL för denna fil:
 * event_props är låst till kategoriska värden (enums, numbers, booleans).
 * Lägg ALDRIG till ett fält som skulle innehålla användarens debattinnehåll,
 * en motdebattörs namn, ett ämnesnamn i fritext, eller annat som kan identifiera
 * personer eller avslöja politiska åsikter.
 *
 * Bra event_props: { topic_area: 'skola', has_kommun: true, attempts: 2 }
 * Dålig event_props: { user_message: 'Hej, jag heter X och vill...', ... }
 */

export const ANALYTICS_EVENTS = {
  // Onboarding
  ONBOARDING_LANDED: "onboarding_landed",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // Snabbstart (Sprint 1)
  SNABBSTART_OPENED: "snabbstart_opened",
  SNABBSTART_EXAMPLE_CLICKED: "snabbstart_example_clicked",
  SNABBSTART_SUBMITTED: "snabbstart_submitted",
  SNABBSTART_PARSE_FAILED: "snabbstart_parse_failed",
  SNABBSTART_FALLBACK_TO_LEGACY: "snabbstart_fallback_to_legacy",

  // Generation
  GENERATION_STARTED: "generation_started",
  GENERATION_FIRST_TOKEN: "generation_first_token",
  GENERATION_COMPLETED: "generation_completed",
  GENERATION_FAILED: "generation_failed",

  // Editor
  EDITOR_OPENED: "editor_opened",
  CARD_REGENERATED: "card_regenerated",
  TELEPROMPTER_OPENED: "teleprompter_opened",

  // Errors
  LLM_RATE_LIMITED: "llm_rate_limited",
  LLM_TIMEOUT: "llm_timeout",

  // Future sprints (för planering — instrumenteras i respektive sprint)
  STYLE_PREFERENCES_OPENED: "style_preferences_opened",
  STYLE_PREFERENCES_QUESTION_SKIPPED: "style_preferences_question_skipped",
  STYLE_PREFERENCES_COMPLETED: "style_preferences_completed",
  SNIPPET_CREATED: "snippet_created",
  SNIPPET_USED: "snippet_used",
  SPARRING_STARTED: "sparring_started",
  SPARRING_TURN_COMPLETED: "sparring_turn_completed",
  SPARRING_SESSION_ENDED: "sparring_session_ended",
  POST_DEBATE_REFLECTION_OPENED: "post_debate_reflection_opened",
  POST_DEBATE_REFLECTION_SAVED: "post_debate_reflection_saved",
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];

/**
 * Tillåtna event_props per event. Detta är dokumentation, inte runtime-validering —
 * men den ska följas vid varje trackEvent-anrop. Sanitizern i analytics.ts strippar
 * alla strängar längre än 32 tecken som extra skyddsmekanism.
 */
export const EVENT_PROPS_SCHEMA = {
  snabbstart_submitted: ["topic_area", "has_kommun", "has_opponent", "speech_length_seconds"],
  snabbstart_parse_failed: ["error_kind"],
  generation_completed: ["model", "duration_ms", "attempts", "tokens_in", "tokens_out"],
  generation_failed: ["error_kind", "attempts", "duration_ms"],
  card_regenerated: ["card_kind"],
  llm_rate_limited: ["attempts", "duration_ms"],
  llm_timeout: ["duration_ms"],
  style_preferences_question_skipped: ["question_index"],
  sparring_started: ["block", "topic"],
  sparring_turn_completed: ["turn_number"],
  // Lägg till nya events HÄR med tillåtna props innan du instrumenterar.
} as const;
