import { supabase } from "@/integrations/supabase/client";
import { EXAMPLE_MANUSCRIPT } from "./exampleManuscript";
import { hexToRgba, hexToDarkText } from "./panelistColors";

const seededKey = (userId: string) => `manuskort:example_seeded:${userId}`;

// Bygger en panelist-mark span identisk med vad TiptapEditor skulle producera.
function panelistSpan(panelistId: string, color: string, name: string, label: string): string {
  const bg = hexToRgba(color, 0.32);
  const fg = hexToDarkText(color);
  const style = `background-color: ${bg}; color: ${fg}; --panelist-bg: ${bg}; --panelist-fg: ${fg}; border-radius: 10px; padding: 2px 8px; position: relative; box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
  return `<span class="panelist-mark" data-panelist-id="${panelistId}" data-panelist-color="${color}" data-panelist-name="${name}" style="${style}">${label}</span>`;
}

// Ersätter [NAMN] och [FULLT NAMN] i HTML mot färgade panelist-markeringar.
function applyPanelistMarks(
  html: string,
  panelists: { id: string; name: string; color: string }[]
): string {
  let out = html;
  for (const p of panelists) {
    const first = p.name.split(" ")[0]; // "Anna Svensson" -> "Anna"
    const fullUpper = p.name.toUpperCase();
    const firstUpper = first.toUpperCase();
    // Fullt namn först (mer specifikt), sen förnamn
    out = out.replaceAll(`[${fullUpper}]`, panelistSpan(p.id, p.color, p.name, p.name));
    out = out.replaceAll(`[${firstUpper}]`, panelistSpan(p.id, p.color, p.name, first));
  }
  return out;
}

/**
 * Seedar exempelmanuset som ett vanligt DB-manus för användaren.
 * Returnerar id på det skapade manuset, eller null om något gick fel.
 */
export async function seedExampleForUser(userId: string): Promise<string | null> {
  const ex = EXAMPLE_MANUSCRIPT;

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
        content_html: applyPanelistMarks(c.content_html, insertedPanelists),
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
