import { useState } from "react";
import { useDebateChat } from "@/hooks/useDebateChat";
import { DebateChatHeader } from "./DebateChatHeader";
import { DebateChatMessages } from "./DebateChatMessages";
import { DebateChatInput } from "./DebateChatInput";
import { DebateChatBubble } from "./DebateChatBubble";

interface Props {
  threadId: string;
}

type Mode = "compact" | "expanded" | "minimized";

export function DebateChatWidget({ threadId }: Props) {
  const [mode, setMode] = useState<Mode>("compact");
  const { messages, sending, sendMessage, threadState } = useDebateChat(threadId);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const quickReplies = ((lastAssistant?.metadata as { quick_replies?: string[] } | undefined)?.quick_replies) || [];

  if (mode === "minimized") {
    return <DebateChatBubble onClick={() => setMode("compact")} />;
  }

  const expanded = mode === "expanded";

  if (expanded) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setMode("compact")} />
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-v2-line flex flex-col pointer-events-auto"
            style={{ width: "min(900px, 92vw)", height: "min(720px, 85vh)" }}>
            <DebateChatHeader
              expanded={true}
              phase={threadState?.bot_state?.phase}
              onToggleExpand={() => setMode("compact")}
              onMinimize={() => setMode("minimized")}
            />
            <DebateChatMessages messages={messages} sending={sending} />
            <DebateChatInput onSend={sendMessage} disabled={sending} quickReplies={quickReplies} />
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-v2-line flex flex-col"
      style={{ width: "380px", height: "560px", maxHeight: "calc(100vh - 3rem)" }}
    >
      <DebateChatHeader
        expanded={false}
        phase={threadState?.bot_state?.phase}
        onToggleExpand={() => setMode("expanded")}
        onMinimize={() => setMode("minimized")}
      />
      <DebateChatMessages messages={messages} sending={sending} />
      <DebateChatInput onSend={sendMessage} disabled={sending} quickReplies={quickReplies} />
    </div>
  );
}
