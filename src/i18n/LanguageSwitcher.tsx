// Liten dropdown för språkval. Persisterar valet i localStorage via setLanguage().

import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setLanguage } from "./index";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = i18n.language === "en" ? "en" : "sv";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          aria-label="Language / Språk"
          className="gap-1.5"
        >
          <Globe className="h-4 w-4" />
          {!compact && <span className="text-xs uppercase">{current}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLanguage("sv")}
          className={current === "sv" ? "font-semibold" : ""}
        >
          🇸🇪 Svenska
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("en")}
          className={current === "en" ? "font-semibold" : ""}
        >
          🇬🇧 English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
