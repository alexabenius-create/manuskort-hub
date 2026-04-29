// Hämtar manuella overrides från edge function och applicerar dem ovanpå i18n-resurser.
// Lyssnar även på realtime-uppdateringar så att en ändring i admin omedelbart syns.

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import i18n, { applyOverrides } from "./index";

interface OverrideMeta {
  source_text: string;
  source_text_at_override: string;
  updated_at: string;
}

let overrideMetaCache: Record<string, OverrideMeta> = {};
const subscribers = new Set<() => void>();

export function getOverrideMeta(key: string): OverrideMeta | undefined {
  return overrideMetaCache[key];
}

export function isManualOverride(key: string): boolean {
  return key in overrideMetaCache;
}

function notify() {
  subscribers.forEach((fn) => fn());
}

export function subscribeToOverrides(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

async function fetchOverrides(language: "sv" | "en") {
  if (language === "sv") {
    overrideMetaCache = {};
    notify();
    return;
  }
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-translations?language=${language}`;
    const res = await fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      overrides: Record<string, string>;
      meta: Record<string, OverrideMeta>;
    };
    applyOverrides(language, data.overrides);
    overrideMetaCache = data.meta ?? {};
    notify();
  } catch (e) {
    console.warn("[i18n] failed to fetch overrides", e);
  }
}

export function useTranslationOverrides() {
  useEffect(() => {
    void fetchOverrides(i18n.language as "sv" | "en");

    const onLangChange = (lng: string) => {
      void fetchOverrides(lng as "sv" | "en");
    };
    i18n.on("languageChanged", onLangChange);

    const channel = supabase
      .channel("translation_overrides_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "translation_overrides" },
        () => void fetchOverrides(i18n.language as "sv" | "en"),
      )
      .subscribe();

    return () => {
      i18n.off("languageChanged", onLangChange);
      supabase.removeChannel(channel);
    };
  }, []);
}

/** Manuellt trigga refetch (efter spara i popover). */
export function refreshOverrides() {
  void fetchOverrides(i18n.language as "sv" | "en");
}
