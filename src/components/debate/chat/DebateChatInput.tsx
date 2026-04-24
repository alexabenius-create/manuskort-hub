import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function DebateChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-v2-line p-3 bg-white rounded-b-2xl">
      <div className="flex items-end gap-2">
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
          onClick={submit}
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
