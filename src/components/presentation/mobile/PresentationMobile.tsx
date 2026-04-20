import type { Database } from "@/integrations/supabase/types";
import type { Panelist } from "@/hooks/usePanelists";
import type { WakeLockStatus } from "@/hooks/useWakeLock";
import type { usePresentationTimer } from "@/hooks/usePresentationTimer";
import type { useCardTimers } from "@/hooks/useCardTimers";

import { PresentationTopbar } from "@/components/presentation/PresentationTopbar";
import { PresentationFooter } from "@/components/presentation/PresentationFooter";
import { PresentationCard } from "@/components/presentation/PresentationCard";

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
 * Mobil-v2 av presentationsläget. Fas 1: stub som återanvänder befintliga
 * desktop-komponenter så att routingen kan verifieras utan visuella regressioner.
 * Fas 2-4 byter ut layouten till CSS Grid + dedikerade mobil-komponenter.
 */
export function PresentationMobile(props: PresentationMobileProps) {
  const {
    manuscript, cards, panelists, current, next, currentIndex,
    hasPanicCards, timer, cardElapsedSeconds, sizeOffset, onSizeChange,
    showNotes, onToggleNotes, onNotesChange, onExit, onPanic, onModeChange,
    onHelpOpen, wakeLockStatus, xVisible, timerMode, overdueDismissedIds,
    onDismissOverdue,
  } = props;

  return (
    <>
      <PresentationTopbar
        mode={timerMode}
        onModeChange={onModeChange}
        direction={timer.direction}
        onDirectionToggle={timer.toggleDirection}
        isPaused={timer.isPaused}
        onPauseToggle={timer.togglePause}
        elapsedSeconds={timer.elapsedSeconds}
        remainingSeconds={timer.remainingSeconds}
        targetSeconds={timer.targetSeconds}
        now={timer.now}
        isWarning={timer.isWarning}
        isOverdue={timer.isOverdue}
        wakeLockStatus={wakeLockStatus}
        onExit={onExit}
        xVisible={xVisible}
        countdownActive={timer.countdown > 0}
      />

      {xVisible && (
        <button
          onClick={onHelpOpen}
          className="fixed z-30 rounded-full bg-zinc-900/80 backdrop-blur border border-zinc-800/60 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all font-mono shadow-lg shadow-black/40 top-1.5 right-10 w-7 h-7 text-[12px]"
          aria-label="Visa hjälp (?)"
          title="Visa hjälp (?)"
        >
          ?
        </button>
      )}

      <main className="flex-1 min-h-0 pt-9 pb-9 px-0 relative">
        <div
          className={`h-full w-full bg-black shadow-2xl overflow-hidden transition-all duration-300 ${
            typeof current.target_seconds === "number" &&
            current.target_seconds > 0 &&
            cardElapsedSeconds > current.target_seconds &&
            !overdueDismissedIds.has(current.id)
              ? "ring-4 ring-red-500 shadow-red-500/40"
              : "shadow-black/40"
          }`}
        >
          <PresentationCard
            card={current}
            panelists={panelists}
            textSize={(manuscript.text_size as "sm" | "md" | "lg") ?? "md"}
            sizeOffset={sizeOffset}
            showNotes={showNotes}
            onToggleNotes={onToggleNotes}
            onNotesChange={(notes) => onNotesChange(current.id, notes)}
          />
        </div>
      </main>

      <PresentationFooter
        current={current}
        next={next}
        index={currentIndex}
        total={cards.length}
        hasPanicCards={hasPanicCards}
        onPanic={onPanic}
        cardElapsedSeconds={cardElapsedSeconds}
        cardTargetSeconds={current.target_seconds ?? null}
        isOverdueDismissed={overdueDismissedIds.has(current.id)}
        onDismissOverdue={() => onDismissOverdue(current.id)}
        timeFormat={timerMode}
        sizeOffset={sizeOffset}
        onSizeChange={onSizeChange}
        visible={true}
        totalRemainingSeconds={timer.remainingSeconds}
        totalTimerMode={timerMode}
        totalNow={timer.now}
        isPaused={timer.isPaused}
        onPauseToggle={timer.togglePause}
        countdownActive={timer.countdown > 0}
        showZoomButtons={xVisible}
      />
    </>
  );
}
