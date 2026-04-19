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
  pageA5: {
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
});

export function ManuscriptPDF({ manuscript, cards, panelists, layout }: ManuscriptPDFProps) {
  const panelistColorById = new Map(panelists.map((p) => [p.id, p.color]));
  const panelistNameById = new Map(panelists.map((p) => [p.id, p.name]));

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

  // Bygg en plan flat lista med alla kort-instanser (en per split)
  type Slot = {
    cardIndex: number;        // 0-baserat
    card: Card;
    cues: ReturnType<typeof readCuesWithLegacyFallback>;
    html: string;
    suffix: string | null;
  };

  const slots: Slot[] = [];
  cards.forEach((card, idx) => {
    const parts = splits.get(card.id) ?? [{ cardId: card.id, suffix: null, html: card.content_html }];
    parts.forEach((part) => {
      slots.push({
        cardIndex: idx,
        card,
        cues: readCuesWithLegacyFallback(card),
        html: part.html,
        suffix: part.suffix,
      });
    });
  });

  const totalCards = cards.length;

  const renderSlot = (slot: Slot) => {
    const { card, cardIndex, cues, html, suffix } = slot;
    const num = String(cardIndex + 1).padStart(2, "0");
    const cardNumberLabel = suffix
      ? `${num}${suffix} / ${String(totalCards).padStart(2, "0")}`
      : `${num} / ${String(totalCards).padStart(2, "0")}`;
    const totalCardsLabel = suffix
      ? `Sida ${cardIndex + 1}${suffix} / ${totalCards}`
      : `Sida ${cardIndex + 1} / ${totalCards}`;

    let roleLabel = "TALARE";
    let roleColor = "#888888";
    if (card.role === "moderator") {
      roleLabel = "MODERATOR";
      roleColor = "#444444";
    }
    // Om kortet har en panelist-mark inuti texten är användaren en panelist —
    // men cards-tabellen har ingen direkt panelist_id; vi visar talare/moderator
    // baserat på role. Färgad rail används för panel-cues istället.

    return (
      <CardOnPage
        manuscriptTitle={manuscript.title}
        totalTargetSeconds={manuscript.target_duration_seconds}
        cardNumberLabel={cardNumberLabel}
        totalCardsLabel={totalCardsLabel}
        roleLabel={roleLabel}
        roleColor={roleColor}
        startTime={card.start_time}
        endTime={card.end_time}
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
          <Page key={i} size={{ width: 595.28, height: 419.53 }} orientation="landscape" style={styles.pageA5}>
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
