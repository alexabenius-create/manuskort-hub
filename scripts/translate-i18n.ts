// Översätter saknade nycklar i en.json baserat på sv.json via Lovable AI Gateway.
// Hoppar över alla nycklar som finns som manuell override i translation_overrides-tabellen.
//
// Körs manuellt: bun run scripts/translate-i18n.ts
//
// Kräver env:
//   LOVABLE_API_KEY  (admin sätter en lokal kopia via `lovable secrets get`, eller exporterar)
//   SUPABASE_URL
//   SUPABASE_ANON_KEY  (eller SERVICE_ROLE_KEY för bättre läsning av DB)

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const SV_PATH = join(ROOT, "src/i18n/locales/sv.json");
const EN_PATH = join(ROOT, "src/i18n/locales/en.json");

const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!LOVABLE_API_KEY) {
  console.error("Missing LOVABLE_API_KEY env var");
  process.exit(1);
}

function flatten(obj: any, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v, key));
  }
  return out;
}

function unflatten(flat: Record<string, string>): any {
  const out: any = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  return out;
}

async function fetchLockedKeys(): Promise<Set<string>> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[i18n] SUPABASE_URL/KEY saknas — hoppar över DB-låsta nycklar.");
    return new Set();
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/translation_overrides?language=eq.en&select=key`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[i18n] Kunde inte läsa overrides (${res.status})`);
      return new Set();
    }
    const rows = (await res.json()) as Array<{ key: string }>;
    return new Set(rows.map((r) => r.key));
  } catch (e) {
    console.warn("[i18n] DB-fetch fail:", e);
    return new Set();
  }
}

async function translateBatch(items: { key: string; sv: string }[]): Promise<Record<string, string>> {
  const sysPrompt = `Du är en professionell översättare för Manuskort, en svensk SaaS för manus i kortformat (för presentationer, tal, panelsamtal). Översätt UI-text från svenska till naturlig amerikansk engelska. Ton: tydlig, direkt, lite varm, ingen jargong. Behåll {variabler} och HTML-taggar exakt. Returnera ENDAST JSON via tool call, ingen extra text.`;

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: sysPrompt },
      {
        role: "user",
        content: `Översätt dessa nycklar till engelska:\n\n${JSON.stringify(items, null, 2)}`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "save_translations",
          description: "Returnera översättningar som key→english map.",
          parameters: {
            type: "object",
            properties: {
              translations: {
                type: "object",
                description: "key (string) → engelsk översättning (string)",
                additionalProperties: { type: "string" },
              },
            },
            required: ["translations"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "save_translations" } },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI gateway ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("Ingen tool_call i svaret");
  const parsed = JSON.parse(args);
  return parsed.translations as Record<string, string>;
}

async function main() {
  const sv = flatten(JSON.parse(readFileSync(SV_PATH, "utf-8")));
  const en = flatten(JSON.parse(readFileSync(EN_PATH, "utf-8")));
  const locked = await fetchLockedKeys();

  const missing: { key: string; sv: string }[] = [];
  for (const [key, value] of Object.entries(sv)) {
    if (locked.has(key)) continue;
    if (!en[key] || en[key].trim() === "") missing.push({ key, sv: value });
  }

  console.log(`Källnycklar: ${Object.keys(sv).length}`);
  console.log(`Låsta (manuella): ${locked.size}`);
  console.log(`Saknar engelsk översättning: ${missing.length}`);

  if (missing.length === 0) {
    console.log("Inget att översätta — allt är uppdaterat. ✓");
    return;
  }

  // Batcha 30 åt gången
  const out: Record<string, string> = { ...en };
  for (let i = 0; i < missing.length; i += 30) {
    const batch = missing.slice(i, i + 30);
    console.log(`Översätter batch ${i / 30 + 1} (${batch.length} nycklar)…`);
    const translated = await translateBatch(batch);
    for (const [k, v] of Object.entries(translated)) {
      out[k] = v;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  writeFileSync(EN_PATH, JSON.stringify(unflatten(out), null, 2) + "\n");
  console.log(`✓ Skrev ${EN_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
