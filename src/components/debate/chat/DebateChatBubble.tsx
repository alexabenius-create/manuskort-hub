import { MessageCircle } from "lucide-react";

interface Props {
  onClick: () => void;
  unread?: number;
}

export function DebateChatBubble({ onClick, unread }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-v2-violet text-white shadow-2xl hover:scale-105 transition-transform flex items-center justify-center"
      aria-label="Öppna Debatt-buddy"
    >
      <MessageCircle className="h-6 w-6" />
      {unread ? (
        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-[11px] font-semibold flex items-center justify-center">
          {unread}
        </span>
      ) : null}
    </button>
  );
}
