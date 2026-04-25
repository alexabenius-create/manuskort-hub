import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/hooks/useDebateChat";

interface Props {
  messages: ChatMessage[];
  sending: boolean;
  onRetry?: () => void;
}

export function DebateChatMessages({ messages, sending, onRetry }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");

  // Hitta sista assistant-meddelandet — bara där visas Försök igen-knappen.
  const lastAssistantId = (() => {
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].role === "assistant") return visible[i].id;
    }
    return null;
  })();

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      <div className="flex flex-col gap-3">
        {visible.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isLastAssistant={m.id === lastAssistantId}
            onRetry={onRetry}
            sending={sending}
          />
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

interface BubbleProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  onRetry?: () => void;
  sending: boolean;
}

function MessageBubble({ message, isLastAssistant, onRetry, sending }: BubbleProps) {
  const isUser = message.role === "user";
  const meta = (message.metadata as { error_kind?: string; retryable?: boolean } | undefined) || {};
  const isError = !isUser && Boolean(meta.error_kind);

  if (isError) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="whitespace-pre-wrap">{message.content}</p>
              {isLastAssistant && meta.retryable && onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 px-2.5 gap-1.5 text-[12px] border-destructive/40 hover:bg-destructive/15"
                  onClick={onRetry}
                  disabled={sending}
                >
                  <RotateCcw className="h-3 w-3" />
                  Försök igen
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
