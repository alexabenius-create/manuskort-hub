import { Mic, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ImportMode } from "@/lib/import/importStore";

interface Props {
  value: ImportMode | null;
  onChange: (m: ImportMode) => void;
}

export function ModeSelector({ value, onChange }: Props) {
  const { t } = useTranslation();
  const options: {
    key: ImportMode;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    desc: string;
  }[] = [
    {
      key: "speaker",
      icon: Mic,
      title: t("import.mode.speaker_title"),
      subtitle: t("import.mode.speaker_subtitle"),
      desc: t("import.mode.speaker_desc"),
    },
    {
      key: "moderator",
      icon: Users,
      title: t("import.mode.moderator_title"),
      subtitle: t("import.mode.moderator_subtitle"),
      desc: t("import.mode.moderator_desc"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {options.map(({ key, icon: Icon, title, subtitle, desc }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={cn(
              "text-left rounded-2xl bg-surface p-6 shadow-card transition-all",
              "border-2 hover:shadow-pop focus:outline-none focus:ring-2 focus:ring-accent-blue",
              active
                ? "border-accent-blue ring-2 ring-accent-blue/20"
                : "border-transparent",
            )}
          >
            <div
              className={cn(
                "h-11 w-11 rounded-xl flex items-center justify-center mb-4 transition-colors",
                active
                  ? "bg-accent-blue text-white"
                  : "bg-accent-blue/10 text-accent-blue",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-[18px] font-semibold tracking-tight">
              {title}
            </h3>
            <p className="text-[13px] text-accent-blue font-medium mt-0.5">
              {subtitle}
            </p>
            <p className="text-[13px] text-muted-foreground mt-3 leading-relaxed">
              {desc}
            </p>
          </button>
        );
      })}
    </div>
  );
}
