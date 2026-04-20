import type { Database } from "@/integrations/supabase/types";
import type { Panelist } from "@/hooks/usePanelists";
import type { WakeLockStatus } from "@/hooks/useWakeLock";
import type { usePresentationTimer } from "@/hooks/usePresentationTimer";
import type { useCardTimers } from "@/hooks/useCardTimers";

import { StickyNote } from "lucide-react";
import { MobileTopbar } from "./MobileTopbar";
import { MobileFooter } from "./MobileFooter";
import { MobileCardContent } from "./MobileCardContent";
import { MobileHelpZone } from "./MobileHelpZone";
import { MobileNotesOverlay } from "./MobileNotesOverlay";
import { MobileEdgeFlash } from "./MobileEdgeFlash";

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
  /** Toggla aux-UI (X, zoom, hjälp) — anropas av central tap-zone. */
  onCenterTap: () => void;
  /** Bläddra till nästa kort (svep åt vänster). */
  onNext: () => void;
  /** Bläddra till föregående kort (svep åt höger). */
  onPrev: () => void;
  timerMode: "clock" | "elapsed";
  overdueDismissedIds: Set<string>;
  onDismissOverdue: (cardId: string) => void;
}

/**
 * Mobil-v2 av presentationsläget. CSS-Grid layout:
 *   [topbar safe-area+] [manus 1fr] [footer ~36px + 2px progress]
 *
 * MobileHelpZone ligger som overlay i row-start-2 och fångar:
 *  - Tap i mitten → toggla X/zoom/hjälp (auto-hide igen efter 3s via parent-timer)
 *  - Svep vänster/höger → byt kort
 */
export function PresentationMobile(props: PresentationMobileProps) {
  const {
    manuscript, cards, panelists, current, currentIndex,
    hasPanicCards, timer, cardElapsedSeconds, sizeOffset, onSizeChange,
    showNotes, onToggleNotes, onNotesChange,
    onExit, onPanic, onHelpOpen, onCenterTap, onNext, onPrev,
    wakeLockStatus, xVisible, timerMode, overdueDismissedIds, onDismissOverdue,
  } = props;

  const hasNotes = !!(current.notes && current.notes.trim().length > 0);

  return (
    <div
      className="fixed inset-0 grid bg-black z-40"
      style={{
        gridTemplateRows: "max(28px, env(safe-area-inset-top, 0px)) 1fr auto",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <MobileTopbar
        onExit={onExit}
        wakeLockStatus={wakeLockStatus}
        isWarning={timer.isWarning}
        isOverdue={timer.isOverdue}
        xVisible={xVisible}
      />

      <div className="row-start-2 relative w-full h-full min-h-0">
        <MobileCardContent
          card={current}
          panelists={panelists}
          textSize={(manuscript.text_size as "sm" | "md" | "lg") ?? "md"}
          sizeOffset={sizeOffset}
        />
        <MobileHelpZone
          onCenterTap={onCenterTap}
          onSwipeLeft={onNext}
          onSwipeRight={onPrev}
        />
        {/* Alltid synlig anteckningsknapp uppe i höger hörn av manusytan (z-30, ovanför HelpZone z-20) */}
        <button
          onClick={onToggleNotes}
          className={`absolute top-1 right-1 z-30 p-1.5 rounded active:bg-zinc-800/60 transition-colors ${
            hasNotes ? "text-amber-300" : "text-zinc-500 hover:text-zinc-300"
          }`}
          aria-label={hasNotes ? "Visa anteckningar" : "Lägg till anteckningar"}
          title={hasNotes ? "Visa anteckningar" : "Lägg till anteckningar"}
        >
          <StickyNote className="h-4 w-4" />
        </button>
      </div>

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
        showAuxControls={xVisible}
        sizeOffset={sizeOffset}
        onSizeChange={onSizeChange}
        onHelpOpen={onHelpOpen}
      />

      {showNotes && (
        <MobileNotesOverlay
          card={current}
          onNotesChange={onNotesChange}
          onClose={onToggleNotes}
        />
      )}
    </div>
  );
}
