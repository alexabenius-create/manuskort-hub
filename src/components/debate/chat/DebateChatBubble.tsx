import { MessageCircle } from "lucide-react";

interface Props {
  onClick: () => void;
  unread?: number;
}

export function DebateChatBubble({ onClick, unread }: Props) {
  return (
    <button
      onClick={onClick}
      className="group fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-pink-500 text-white shadow-xl shadow-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/50 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center ring-2 ring-white"
      aria-label="Öppna Debatt-buddy"
    >
      {/* pulserande ring */}
      <span aria-hidden className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping opacity-60 group-hover:opacity-0 transition-opacity" />
      <MessageCircle className="relative h-6 w-6 drop-shadow" strokeWidth={2.25} />
      {/* sparkle-prick */}
      <span aria-hidden className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-white shadow-md flex items-center justify-center">
        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500" />
      </span>
      {unread ? (
        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-[11px] font-semibold flex items-center justify-center ring-2 ring-white">
          {unread}
        </span>
      ) : null}
    </button>
  );
}
