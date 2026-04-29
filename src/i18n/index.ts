// i18n-init: svenska som källa, engelska som auto-översatt + manuella overrides från DB.
//
// Prioritet vid lookup för engelska:
//   1. translation_overrides (DB, manuella låsningar) — laddas via edge function
//   2. en.json (AI-genererad)
//   3. sv.json (fallback)
//
// Språkval: query-param ?lang → localStorage → domän (.com=en, annars sv) → navigator.language

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import sv from "./locales/sv.json";
import en from "./locales/en.json";

const STORAGE_KEY = "manuskort-lang";

function detectInitialLanguage(): "sv" | "en" {
  if (typeof window === "undefined") return "sv";
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get("lang");
  if (fromParam === "en" || fromParam === "sv") {
    localStorage.setItem(STORAGE_KEY, fromParam);
    return fromParam;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "sv") return stored;
  const host = window.location.hostname;
  // Engelska domäner: manuskort.com (svenska huvuddomän är manuskort.se).
  if (host === "manuskort.com" || host.endsWith(".manuskort.com")) return "en";
  if (host.endsWith(".se") || host === "manuskort.se" || host.endsWith(".manuskort.se"))
    return "sv";
  // Annars browser-språk (lovable.app, localhost, etc.)
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en"))
    return "en";
  return "sv";
}

const initialLang = detectInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    sv: { translation: sv },
    en: { translation: en },
  },
  lng: initialLang,
  fallbackLng: "sv",
  interpolation: { escapeValue: false },
  returnNull: false,
});

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLang === "en" ? "en" : "sv";
}

export function setLanguage(lang: "sv" | "en") {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

/** Applicera manuella overrides ovanpå basresurserna. */
export function applyOverrides(language: "sv" | "en", overrides: Record<string, string>) {
  // i18next stödjer addResources med flat keys via deep notation.
  // Vi väntar oss nycklar som "landing.hero.title".
  for (const [key, value] of Object.entries(overrides)) {
    i18n.addResource(language, "translation", key, value);
  }
}

export default i18n;
