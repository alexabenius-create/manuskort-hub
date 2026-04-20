import type { Database } from "@/integrations/supabase/types";
import type { Panelist } from "@/hooks/usePanelists";
import type { WakeLockStatus } from "@/hooks/useWakeLock";
import type { usePresentationTimer } from "@/hooks/usePresentationTimer";
import type { useCardTimers } from "@/hooks/useCardTimers";

import { MobileTopbar } from "./MobileTopbar";
import { MobileFooter } from "./MobileFooter";
import { MobileCardContent } from "./MobileCardContent";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"] & { is_panic_card: boolean };
type Timer = ReturnType<typeof usePresentationTimer>;
type CardTimers = ReturnType<typeof useCardTimers>;

export interface PresentationMobileProps {
  manuscript: Manuscript;
  cards: Card[];
  panelists: Panelist[];
  currentIndex: number;
  current: Card;
  next: Card | undefined;
  hasPanicCards: boolean;
  timer: Timer;
  cardTimers: CardTimers;
  cardElapsedSeconds: number;
  sizeOffset: number;
  onSizeChange: (offset: number) => void;
  showNotes: boolean;
  onToggleNotes: () => void;
  onNotesChange: (cardId: string, notes: string) => void;
  onExit: () => void;
  onPanic: () => void;
  onModeChange: (next: "clock" | "elapsed") => void;
  onHelpOpen: () => void;
  wakeLockStatus: WakeLockStatus;
  xVisible: boolean;
  timerMode: "clock" | "elapsed";
  overdueDismissedIds: Set<string>;
  onDismissOverdue: (cardId: string) => void;
}

/**
 * Mobil-v2 av presentationsläget. Fas 2: dedikerad CSS-Grid-layout:
 *   [topbar 28px] [manus 1fr] [footer ~36px + 2px progress]
 *
 * Manustexten är kant-till-kant och får all återstående yta.
 * Topbar och footer är alltid renderade — `xVisible` styr bara opacity på X-knappen.
 */
export function PresentationMobile(props: PresentationMobileProps) {
  const {
    manuscript, cards, panelists, current, currentIndex,
    hasPanicCards, timer, cardElapsedSeconds, sizeOffset,
    onExit, onPanic, wakeLockStatus, xVisible, timerMode, overdueDismissedIds,
    onDismissOverdue,
  } = props;

  return (
    <div
      className="fixed inset-0 grid bg-black z-40"
      style={{ gridTemplateRows: "28px 1fr auto" }}
    >
      <MobileTopbar
        onExit={onExit}
        wakeLockStatus={wakeLockStatus}
        isWarning={timer.isWarning}
        isOverdue={timer.isOverdue}
        xVisible={xVisible}
      />

      <MobileCardContent
        card={current}
        panelists={panelists}
        textSize={(manuscript.text_size as "sm" | "md" | "lg") ?? "md"}
        sizeOffset={sizeOffset}
      />

      <MobileFooter
        current={current}
        index={currentIndex}
        total={cards.length}
        hasPanicCards={hasPanicCards}
        onPanic={onPanic}
        cardElapsedSeconds={cardElapsedSeconds}
        cardTargetSeconds={current.target_seconds ?? null}
        isOverdueDismissed={overdueDismissedIds.has(current.id)}
        onDismissOverdue={() => onDismissOverdue(current.id)}
        timeFormat={timerMode}
        totalRemainingSeconds={timer.remainingSeconds}
        totalTimerMode={timerMode}
        totalNow={timer.now}
        isPaused={timer.isPaused}
        onPauseToggle={timer.togglePause}
        countdownActive={timer.countdown > 0}
      />
    </div>
  );
}
