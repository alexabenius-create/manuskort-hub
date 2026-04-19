import { supabase } from "@/integrations/supabase/client";
import { EXAMPLE_MANUSCRIPT } from "./exampleManuscript";
import { hexToRgba, hexToDarkText } from "./panelistColors";
import { autofillProfilePlaceholders, type ProfileValues } from "./profilePlaceholders";
import { newCueId, serializeCues, type Cue } from "./cues";

const seededKey = (userId: string) => `manuskort:example_seeded:${userId}`;

// Bygger en panelist-mark span identisk med vad TiptapEditor skulle producera.
function panelistSpan(panelistId: string, color: string, name: string, label: string): string {
  const bg = hexToRgba(color, 0.32);
  const fg = hexToDarkText(color);
  const style = `background-color: ${bg}; color: ${fg}; --panelist-bg: ${bg}; --panelist-fg: ${fg}; border-radius: 10px; padding: 2px 8px; position: relative; box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
  return `<span class="panelist-mark" data-panelist-id="${panelistId}" data-panelist-color="${color}" data-panelist-name="${name}" style="${style}">${label}</span>`;
}

// Ersätter [[PANELIST:Förnamn]]...innehåll...[[/PANELIST]] mot färgade panelist-markeringar.
// Bakåtkompatibel: [NAMN] och [FULLT NAMN] (versaler) ersätts också till en namn-pillet.
function applyPanelistMarks(
  html: string,
  panelists: { id: string; name: string; color: string }[]
): string {
  let out = html;
  const byFirst = new Map<string, { id: string; name: string; color: string }>();
  for (const p of panelists) byFirst.set(p.name.split(" ")[0].toLowerCase(), p);

  // Nya markörer: [[PANELIST:Förnamn]]inner[[/PANELIST]]
  out = out.replace(
    /\[\[PANELIST:([^\]]+)\]\]([\s\S]*?)\[\[\/PANELIST\]\]/g,
    (_full, first: string, inner: string) => {
      const p = byFirst.get(first.trim().toLowerCase());
      if (!p) return inner;
      return panelistSpan(p.id, p.color, p.name, inner);
    }
  );

  // Bakåtkompatibilitet: [NAMN] / [FULLT NAMN] (versaler).
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const p of panelists) {
    const first = p.name.split(" ")[0];
    const fullUpper = p.name.toUpperCase();
    const firstUpper = first.toUpperCase();
    out = out.replace(new RegExp(`\\[${escape(fullUpper)}\\]`, "g"), panelistSpan(p.id, p.color, p.name, p.name));
    out = out.replace(new RegExp(`\\[${escape(firstUpper)}\\]`, "g"), panelistSpan(p.id, p.color, p.name, first));
  }
  return out;
}

/**
 * Seedar exempelmanuset som ett vanligt DB-manus för användaren.
 * Returnerar id på det skapade manuset, eller null om något gick fel.
 */
export async function seedExampleForUser(userId: string): Promise<string | null> {
  const ex = EXAMPLE_MANUSCRIPT;

  // Hämta profilvärden för autofyllning av [ditt namn], [din titel], [din organisation]
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name, display_title, display_org")
    .eq("user_id", userId)
    .maybeSingle();
  const profile: ProfileValues = profileRow ?? {};

  const { data: ms, error: msErr } = await supabase
    .from("manuscripts")
    .insert({
      user_id: userId,
      title: ex.title,
      mode: ex.mode,
      tags: ex.tags,
      text_size: ex.text_size,
      show_notes: ex.show_notes,
      show_times: ex.show_times,
      wpm: ex.wpm,
      time_format: ex.time_format,
      target_duration_seconds: ex.target_duration_seconds,
    })
    .select()
    .single();

  if (msErr || !ms) {
    console.error("seedExampleForUser: manuscripts insert failed", msErr);
    return null;
  }

  // Insert panelists — vi behöver deras genererade UUIDn för att kunna ersätta
  // namn-platshållare i kort-HTML:n.
  let insertedPanelists: { id: string; name: string; color: string }[] = [];
  if (ex.panelists.length) {
    const { data: pData, error: pErr } = await supabase
      .from("panelists")
      .insert(
        ex.panelists.map((p) => ({
          manuscript_id: ms.id,
          user_id: userId,
          name: p.name,
          color: p.color,
          position: p.position,
        }))
      )
      .select();
    if (pErr) console.error("seedExampleForUser: panelists insert failed", pErr);
    insertedPanelists = (pData ?? []).map((p) => ({ id: p.id, name: p.name, color: p.color }));
  }

  if (ex.cards.length) {
    const { error: cErr } = await supabase.from("cards").insert(
      ex.cards.map((c) => ({
        manuscript_id: ms.id,
        user_id: userId,
        position: c.position,
        role: c.role,
        title: c.title,
        content_html: applyPanelistMarks(autofillProfilePlaceholders(c.content_html, profile), insertedPanelists),
        notes: c.notes,
        start_time: c.start_time,
        end_time: c.end_time,
        cue_red: c.cue_red,
        cue_amber: c.cue_amber,
        cue_teal: c.cue_teal,
        is_panic_card: c.is_panic_card,
      }))
    );
    if (cErr) console.error("seedExampleForUser: cards insert failed", cErr);
  }

  try {
    localStorage.setItem(seededKey(userId), "1");
  } catch {
    // ignore
  }

  return ms.id;
}

export function hasBeenSeeded(userId: string): boolean {
  try {
    return localStorage.getItem(seededKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markAsSeeded(userId: string) {
  try {
    localStorage.setItem(seededKey(userId), "1");
  } catch {
    // ignore
  }
}
