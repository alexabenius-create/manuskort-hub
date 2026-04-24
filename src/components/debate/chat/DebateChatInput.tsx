import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  quickReplies?: string[];
}

export function DebateChatInput({ onSend, disabled, quickReplies = [] }: Props) {
  const [text, setText] = useState("");

  const submit = (override?: string) => {
    const value = (override ?? text).trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-v2-line bg-white rounded-b-2xl">
      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              disabled={disabled}
              className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-v2-violet/40 bg-v2-violet/5 text-v2-violet hover:bg-v2-violet/10 transition disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Skriv ett meddelande…"
          disabled={disabled}
          rows={1}
          className="min-h-[40px] max-h-32 resize-none text-[14px]"
        />
        <Button
          onClick={() => submit()}
          disabled={disabled || !text.trim()}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label="Skicka"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
