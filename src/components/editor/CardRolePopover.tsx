/**
 * CardRolePopover — väljare i kort-headern för moderator/talare-roll.
 */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Mic, Headphones, Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type Role = "speaker" | "moderator";

interface Props {
  role: Role;
  onChange: (next: Role) => void;
}

export function CardRolePopover({ role, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const isModerator = role === "moderator";
  const Icon = isModerator ? Headphones : Mic;
  const label = isModerator ? t("editor.card.role_moderator") : t("editor.card.role_speaker");

  const select = (next: Role) => {
    if (next !== role) onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          contentEditable={false}
          className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[11px] font-mono uppercase tracking-wider transition-colors ${
            isModerator
              ? "bg-accent-blue/10 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/15"
              : "bg-surface-2 text-muted-foreground border-border/40 hover:text-foreground hover:border-border"
          }`}
          aria-label={t("editor.card.role_aria", { role: label })}
        >
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-44 p-1"
        contentEditable={false}
      >
        <button
          type="button"
          onClick={() => select("speaker")}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] hover:bg-muted transition-colors text-left"
        >
          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">{t("editor.card.role_speaker")}</span>
          {role === "speaker" && <Check className="h-3.5 w-3.5 text-accent-blue" />}
        </button>
        <button
          type="button"
          onClick={() => select("moderator")}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] hover:bg-muted transition-colors text-left"
        >
          <Headphones className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">{t("editor.card.role_moderator")}</span>
          {role === "moderator" && <Check className="h-3.5 w-3.5 text-accent-blue" />}
        </button>
      </PopoverContent>
    </Popover>
  );
}
