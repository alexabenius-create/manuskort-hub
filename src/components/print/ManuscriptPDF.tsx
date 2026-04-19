import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { CardOnPage } from "./CardOnPage";
import { usePrintLayout, type PrintCardInput } from "./usePrintLayout";
import { readCuesWithLegacyFallback } from "@/lib/cues";
import type { Database } from "@/integrations/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Panelist = Database["public"]["Tables"]["panelists"]["Row"];

interface ManuscriptPDFProps {
  manuscript: Manuscript;
  cards: Card[];
  panelists: Panelist[];
  layout: "a5" | "a4-2up";
}

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: "#FFFFFF",
  },
  pageA4: {
    padding: 0,
    backgroundColor: "#FFFFFF",
    flexDirection: "column",
  },
  cardSlot: {
    width: "100%",
    height: "50%",
  },
  divider: {
    position: "absolute",
    left: "5%",
    right: "5%",
    top: "50%",
    height: 0,
    borderTopWidth: 0.5,
    borderTopColor: "#E0E0E0",
    borderTopStyle: "dashed",
  },
});

function parseTimeToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function ManuscriptPDF({ manuscript, cards, panelists, layout }: ManuscriptPDFProps) {
  const panelistColorById = new Map(panelists.map((p) => [p.id, p.color]));
  const panelistNameById = new Map(panelists.map((p) => [p.id, p.name]));

  // Beräkna kumulativa tider från target_seconds (faller tillbaka till start/end_time-strängar).
  const cumulativeRanges: Array<{ start: number | null; end: number | null }> = [];
  let acc = 0;
  let hasAnyTarget = false;
  cards.forEach((c) => {
    const t = c.target_seconds ?? 0;
    if (c.target_seconds !== null && c.target_seconds !== undefined) hasAnyTarget = true;
    const start = acc;
    const end = acc + t;
    cumulativeRanges.push({ start, end });
    acc = end;
  });

  // Om inga target_seconds finns, använd kortens manuella start/end_time (om satta).
  if (!hasAnyTarget) {
    cards.forEach((c, i) => {
      cumulativeRanges[i] = {
        start: parseTimeToSeconds(c.start_time),
        end: parseTimeToSeconds(c.end_time),
      };
    });
  }

  const inputs: PrintCardInput[] = cards.map((c) => {
    const cues = readCuesWithLegacyFallback(c);
    return {
      id: c.id,
      content_html: c.content_html,
      notes: c.notes,
      cues,
      hasNotes: !!c.notes && c.notes.trim().length > 0,
    };
  });

  const { fontSize, splits } = usePrintLayout(inputs, layout);

  type Slot = {
    cardIndex: number;
    card: Card;
    cues: ReturnType<typeof readCuesWithLegacyFallback>;
    html: string;
    suffix: string | null;
    cumStart: number | null;
    cumEnd: number | null;
  };

  const slots: Slot[] = [];
  cards.forEach((card, idx) => {
    const parts = splits.get(card.id) ?? [{ cardId: card.id, suffix: null, html: card.content_html }];
    const range = cumulativeRanges[idx];
    parts.forEach((part) => {
      slots.push({
        cardIndex: idx,
        card,
        cues: readCuesWithLegacyFallback(card),
        html: part.html,
        suffix: part.suffix,
        cumStart: range.start,
        cumEnd: range.end,
      });
    });
  });

  const totalCards = cards.length;

  const renderSlot = (slot: Slot) => {
    const { card, cardIndex, cues, html, suffix, cumStart, cumEnd } = slot;
    const num = String(cardIndex + 1).padStart(2, "0");
    const totalNum = String(totalCards).padStart(2, "0");
    const cardNumberLabel = suffix ? `${num}${suffix} / ${totalNum}` : `${num} / ${totalNum}`;
    const totalCardsLabel = suffix
      ? `Sida ${cardIndex + 1}${suffix} / ${totalCards}`
      : `Sida ${cardIndex + 1} / ${totalCards}`;

    // Hitta panelist för panel-cues — om ett kort har precis en panel-cue använd
    // dess färg som rail-färg (ger panelist-känsla även för "speaker"-roll).
    const panelCue = cues.find((c) => c.kind === "panel" && c.panelistId);
    const panelistColor = panelCue?.panelistId
      ? panelistColorById.get(panelCue.panelistId)
      : undefined;
    const panelistName = panelCue?.panelistId
      ? panelistNameById.get(panelCue.panelistId)
      : undefined;

    let roleLabel = "TALARE";
    let roleColor = "#4A4A4A";
    if (card.role === "moderator") {
      roleLabel = "MODERATOR";
      roleColor = "#2A2A2A";
    }
    if (panelistColor && panelistName) {
      roleLabel = panelistName;
      roleColor = panelistColor;
    }

    return (
      <CardOnPage
        manuscriptTitle={manuscript.title}
        totalTargetSeconds={manuscript.target_duration_seconds}
        cardNumberLabel={cardNumberLabel}
        totalCardsLabel={totalCardsLabel}
        roleLabel={roleLabel}
        roleColor={roleColor}
        cumulativeStartSeconds={cumStart}
        cumulativeEndSeconds={cumEnd}
        targetSeconds={card.target_seconds}
        cues={cues}
        contentHtml={html}
        notes={card.notes}
        hasNotes={!!card.notes && card.notes.trim().length > 0}
        fontSize={fontSize}
        panelistColorById={panelistColorById}
        panelistNameById={panelistNameById}
      />
    );
  };

  if (layout === "a5") {
    return (
      <Document>
        {slots.map((slot, i) => (
          <Page key={i} size="A5" orientation="landscape" style={styles.page}>
            {renderSlot(slot)}
          </Page>
        ))}
      </Document>
    );
  }

  // A4 stående, 2 kort per sida
  const pairs: Slot[][] = [];
  for (let i = 0; i < slots.length; i += 2) {
    pairs.push(slots.slice(i, i + 2));
  }

  return (
    <Document>
      {pairs.map((pair, i) => (
        <Page key={i} size="A4" orientation="portrait" style={styles.pageA4}>
          <View style={styles.cardSlot}>{renderSlot(pair[0])}</View>
          {pair[1] && <View style={styles.cardSlot}>{renderSlot(pair[1])}</View>}
        </Page>
      ))}
    </Document>
  );
}
