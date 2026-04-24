import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/hooks/useDebateChat";

interface Props {
  messages: ChatMessage[];
  sending: boolean;
}

export function DebateChatMessages({ messages, sending }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      <div className="flex flex-col gap-3">
        {visible.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-v2-muted text-[13px] pl-2">
            <Sparkles className="h-3.5 w-3.5 text-v2-violet animate-pulse" />
            <span>Debatt-buddy skriver…</span>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
          isUser
            ? "bg-v2-violet text-white rounded-br-sm"
            : "bg-v2-surface border border-v2-line text-v2-ink rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
