import { useEffect, useState } from "react";
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
  const { messages, sending, uploading, sendMessage, retryLastAssistant, uploadBrief, threadState } = useDebateChat(threadId);

  // Externa triggers (t.ex. "+ Nytt genmäle") kan be widgeten öppna sig så bot-svaret syns.
  useEffect(() => {
    const handler = () => setMode((m) => (m === "minimized" ? "compact" : m));
    window.addEventListener("debate-chat-open", handler);
    return () => window.removeEventListener("debate-chat-open", handler);
  }, []);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const quickReplies = ((lastAssistant?.metadata as { quick_replies?: string[] } | undefined)?.quick_replies) || [];
  const phase = threadState?.bot_state?.phase;
  const showUpload = !phase || phase === "intake_brief" || phase === "intake_issue";

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
              phase={phase}
              onToggleExpand={() => setMode("compact")}
              onMinimize={() => setMode("minimized")}
            />
            <DebateChatMessages messages={messages} sending={sending} onRetry={retryLastAssistant} />
            <DebateChatInput
              onSend={sendMessage}
              onUploadFile={uploadBrief}
              disabled={sending}
              uploading={uploading}
              showUpload={showUpload}
              quickReplies={quickReplies}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl shadow-indigo-900/15 ring-1 ring-indigo-100 border border-v2-line flex flex-col overflow-hidden animate-scale-in"
      style={{ width: "380px", height: "560px", maxHeight: "calc(100vh - 3rem)" }}
    >
      <DebateChatHeader
        expanded={false}
        phase={phase}
        onToggleExpand={() => setMode("expanded")}
        onMinimize={() => setMode("minimized")}
      />
      <DebateChatMessages messages={messages} sending={sending} onRetry={retryLastAssistant} />
      <DebateChatInput
        onSend={sendMessage}
        onUploadFile={uploadBrief}
        disabled={sending}
        uploading={uploading}
        showUpload={showUpload}
        quickReplies={quickReplies}
      />
    </div>
  );
}
