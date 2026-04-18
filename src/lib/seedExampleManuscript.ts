import { supabase } from "@/integrations/supabase/client";
import { EXAMPLE_MANUSCRIPT } from "./exampleManuscript";

const seededKey = (userId: string) => `manuskort:example_seeded:${userId}`;

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

  if (ex.panelists.length) {
    const { error: pErr } = await supabase.from("panelists").insert(
      ex.panelists.map((p) => ({
        manuscript_id: ms.id,
        user_id: userId,
        name: p.name,
        color: p.color,
        position: p.position,
      }))
    );
    if (pErr) console.error("seedExampleForUser: panelists insert failed", pErr);
  }

  if (ex.cards.length) {
    const { error: cErr } = await supabase.from("cards").insert(
      ex.cards.map((c) => ({
        manuscript_id: ms.id,
        user_id: userId,
        position: c.position,
        role: c.role,
        title: c.title,
        content_html: c.content_html,
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
