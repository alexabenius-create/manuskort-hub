import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { renderHtmlToPdf } from "./htmlToPdfNodes";
import { CUE_COLORS } from "./cueStyles";
import type { Cue } from "@/lib/cues";
import { hexToRgba } from "@/lib/panelistColors";

export interface CardOnPageProps {
  manuscriptTitle: string;
  totalTargetSeconds: number | null;
  cardNumberLabel: string;       // "03 / 10" eller "03a / 10"
  totalCardsLabel: string;       // "Sida 3 / 10" eller "Sida 3a / 10"
  roleLabel: string;             // "TALARE" / "ANNA SJÖBERG"
  roleColor: string;             // hex för vänsterkant
  startTime: string;
  endTime: string;
  targetSeconds: number | null;
  cues: Cue[];
  contentHtml: string;
  notes: string;
  hasNotes: boolean;
  fontSize: number;              // gemensam textstorlek i pt
  panelistColorById?: Map<string, string>;
  panelistNameById?: Map<string, string>;
}

const PT_PER_MM = 2.8346;
const CARD_WIDTH_MM = 210;
const CARD_HEIGHT_MM = 148;
const PAD_MM = 12;

function formatSec(sec: number | null): string {
  if (sec === null || sec === undefined) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH_MM * PT_PER_MM,
    height: CARD_HEIGHT_MM * PT_PER_MM,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    fontFamily: "Helvetica",
    color: "#111111",
  },
  leftRail: {
    width: 6,
    height: "100%",
  },
  inner: {
    flex: 1,
    paddingTop: PAD_MM * PT_PER_MM,
    paddingBottom: PAD_MM * PT_PER_MM,
    paddingLeft: (PAD_MM - 2) * PT_PER_MM,
    paddingRight: PAD_MM * PT_PER_MM,
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  manuscriptTitle: {
    fontSize: 9,
    color: "#666666",
    flex: 1,
    paddingRight: 8,
  },
  cardNumber: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#222222",
  },
  roleLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#444444",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  cueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  cueChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.8,
    borderRadius: 3,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 5,
    paddingRight: 5,
    marginRight: 5,
    marginBottom: 4,
  },
  cueLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    marginRight: 4,
  },
  cueText: {
    fontSize: 8.5,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
  },
  scriptCol: {
    flex: 1,
    paddingRight: 8,
  },
  scriptColFull: {
    flex: 1,
  },
  notesCol: {
    width: "38%",
    borderLeftWidth: 0.8,
    borderLeftColor: "#CCCCCC",
    paddingLeft: 8,
  },
  notesLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#777777",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#333333",
    lineHeight: 1.45,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#DDDDDD",
  },
  footerText: {
    fontSize: 7.5,
    color: "#777777",
  },
  footerStrong: {
    fontSize: 7.5,
    color: "#444444",
    fontFamily: "Helvetica-Bold",
  },
});

export function CardOnPage(props: CardOnPageProps) {
  const {
    manuscriptTitle,
    totalTargetSeconds,
    cardNumberLabel,
    totalCardsLabel,
    roleLabel,
    roleColor,
    startTime,
    endTime,
    targetSeconds,
    cues,
    contentHtml,
    notes,
    hasNotes,
    fontSize,
    panelistColorById,
    panelistNameById,
  } = props;

  return (
    <View style={styles.card} wrap={false}>
      <View style={[styles.leftRail, { backgroundColor: roleColor }]} />
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.manuscriptTitle}>{manuscriptTitle}</Text>
          <Text style={styles.cardNumber}>{cardNumberLabel}</Text>
        </View>

        {/* Roll-etikett */}
        <Text style={styles.roleLabel}>{roleLabel.toUpperCase()}</Text>

        {/* Cue-chippar */}
        {cues.length > 0 && (
          <View style={styles.cueRow}>
            {cues.map((cue) => {
              const palette =
                cue.kind === "panel" && cue.panelistId
                  ? buildPanelChipPalette(cue.panelistId, panelistColorById)
                  : CUE_COLORS[cue.kind];
              const label =
                cue.kind === "panel" && cue.panelistId && panelistNameById?.get(cue.panelistId)
                  ? panelistNameById.get(cue.panelistId)!.toUpperCase()
                  : palette.label;
              return (
                <View
                  key={cue.id}
                  style={[
                    styles.cueChip,
                    { backgroundColor: palette.bg, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.cueLabel, { color: palette.text }]}>{label}:</Text>
                  <Text style={[styles.cueText, { color: palette.text }]}>{cue.text}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Body: script + notes */}
        <View style={styles.body}>
          <View style={hasNotes ? styles.scriptCol : styles.scriptColFull}>
            {renderHtmlToPdf(contentHtml, { fontSize, lineHeight: 1.45 })}
          </View>
          {hasNotes && (
            <View style={styles.notesCol}>
              <Text style={styles.notesLabel}>ANTECKNINGAR</Text>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.footerStrong}>Mål: </Text>
            {formatSec(targetSeconds)}
            {"   "}
            <Text style={styles.footerStrong}>Tid: </Text>
            {startTime || "—"} → {endTime || "—"}
          </Text>
          <Text style={styles.footerText}>
            <Text style={styles.footerStrong}>Totalt mål: </Text>
            {formatSec(totalTargetSeconds)}
            {"   "}
            {totalCardsLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

function buildPanelChipPalette(
  panelistId: string,
  colorMap?: Map<string, string>,
): { bg: string; border: string; text: string; label: string } {
  const color = colorMap?.get(panelistId) ?? "#C04040";
  return {
    bg: hexToRgba(color, 0.22),
    border: color,
    text: "#333333",
    label: "PANEL",
  };
}
