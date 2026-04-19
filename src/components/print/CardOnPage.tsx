import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { renderHtmlToPdf } from "./htmlToPdfNodes";
import { CUE_COLORS } from "./cueStyles";
import type { Cue } from "@/lib/cues";
import { hexToRgba } from "@/lib/panelistColors";

export interface CardOnPageProps {
  manuscriptTitle: string;
  totalTargetSeconds: number | null;
  cardNumberLabel: string;       // "03 / 10" eller "03a / 10"
  cardNumberShort: string;       // "1" eller "1A" (för sidfot)
  totalCardsLabel: string;       // "Sida 3 / 10" eller "Sida 3a / 10"
  roleLabel: string;             // "TALARE" / "ANNA SJÖBERG"
  roleColor: string;             // hex för rolletikett
  cumulativeStartSeconds: number | null;
  cumulativeEndSeconds: number | null;
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
const PAD_MM = 10;
const FRAME_MARGIN_MM = 5;

function formatSec(sec: number | null): string {
  if (sec === null || sec === undefined) return "—";
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    height: "100%",
    padding: FRAME_MARGIN_MM * PT_PER_MM,
    backgroundColor: "#FFFFFF",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    flexDirection: "column",
    fontFamily: "Helvetica",
    color: "#1A1A1A",
    borderWidth: 0.75,
    borderColor: "#D0D0D0",
    borderRadius: 14,
    overflow: "hidden",
  },
  inner: {
    flex: 1,
    paddingTop: PAD_MM * PT_PER_MM,
    paddingBottom: PAD_MM * PT_PER_MM,
    paddingLeft: PAD_MM * PT_PER_MM,
    paddingRight: PAD_MM * PT_PER_MM,
    flexDirection: "column",
  },

  // ---- Header ----
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
    flexDirection: "column",
  },
  manuscriptTitle: {
    fontSize: 8.5,
    color: "#888888",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  roleLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.6,
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  cardNumber: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    letterSpacing: -0.5,
    lineHeight: 1,
  },
  cardNumberCaption: {
    fontSize: 7,
    color: "#999999",
    letterSpacing: 1,
    marginTop: 4,
  },

  // ---- Cue chips (trigger row) ----
  cueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  cueChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 8,
    paddingRight: 9,
    marginRight: 6,
    marginBottom: 5,
  },
  cueLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    marginRight: 5,
  },
  cueText: {
    fontSize: 9,
  },

  // ---- Body ----
  body: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
  },
  scriptCol: {
    flex: 1,
    paddingRight: 14,
  },
  scriptColFull: {
    flex: 1,
    paddingRight: 14,
  },
  notesCol: {
    width: "25%",
    borderLeftWidth: 0.6,
    borderLeftColor: "#D8D8D8",
    paddingLeft: 12,
  },
  notesLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: "#3A3A3A",
    lineHeight: 1.5,
  },

  // ---- Footer ----
  footerWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#D8D8D8",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  footerLabel: {
    fontSize: 8,
    color: "#888888",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
  },
  footerValue: {
    fontSize: 11,
    color: "#1A1A1A",
    fontFamily: "Courier-Bold",
  },
});

export function CardOnPage(props: CardOnPageProps) {
  const {
    manuscriptTitle,
    cardNumberLabel,
    cardNumberShort,
    roleLabel,
    roleColor,
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
    <View style={styles.frame} wrap={false}>
      <View style={styles.card}>
        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.manuscriptTitle}>{manuscriptTitle}</Text>
              <Text style={[styles.roleLabel, { color: roleColor }]}>
                {roleLabel.toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.cardNumber}>{cardNumberLabel}</Text>
              <Text style={styles.cardNumberCaption}>KORT</Text>
            </View>
          </View>

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
                    style={[styles.cueChip, { backgroundColor: palette.bg }]}
                  >
                    <Text style={[styles.cueLabel, { color: palette.text }]}>{label}</Text>
                    <Text style={[styles.cueText, { color: palette.text }]}>{cue.text}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Body: script + notes */}
          <View style={styles.body}>
            <View style={hasNotes ? styles.scriptCol : styles.scriptColFull}>
              {renderHtmlToPdf(contentHtml, { fontSize, lineHeight: 1.5 })}
            </View>
            {hasNotes && (
              <View style={styles.notesCol}>
                <Text style={styles.notesLabel}>ANTECKNINGAR</Text>
                <Text style={styles.notesText}>{notes}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footerWrap}>
            <Text style={styles.footerLabel}>
              TID FÖR DETTA KORTET (KORT {cardNumberShort.toUpperCase()})
            </Text>
            <Text style={styles.footerValue}>{formatSec(targetSeconds)}</Text>
          </View>
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
    bg: hexToRgba(color, 0.28),
    border: color,
    text: "#3A1A1A",
    label: "PANEL",
  };
}
