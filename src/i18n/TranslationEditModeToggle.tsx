// Toggle för översättningsläge — visas endast för admins när språk = engelska.
// Pennikon i header. Aktiverat läge → subtil gul ram runt viewport + pennor vid varje text.

import { Pencil } from "lucide-react";
import { useTier } from "@/hooks/useTier";
import { useTranslation } from "react-i18next";
import { useTranslationEditMode } from "./TranslationEditModeContext";
import { Button } from "@/components/ui/button";

export function TranslationEditModeToggle() {
  const { isAdmin } = useTier();
  const { i18n, t } = useTranslation();
  const { editMode, toggleEditMode } = useTranslationEditMode();

  if (!isAdmin || i18n.language !== "en") return null;

  return (
    <Button
      type="button"
      size="icon"
      variant={editMode ? "default" : "ghost"}
      onClick={toggleEditMode}
      aria-label={t("translation_edit.toggle_label")}
      title={t("translation_edit.toggle_label")}
      className={editMode ? "bg-amber-400 hover:bg-amber-500 text-zinc-900" : ""}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );
}

/** Visuell viewport-ram + banner när edit-läget är aktivt. Render i App-roten. */
export function TranslationEditModeOverlay() {
  const { editMode } = useTranslationEditMode();
  const { t } = useTranslation();
  if (!editMode) return null;
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ boxShadow: "inset 0 0 0 3px hsl(45 95% 55% / 0.7)" }}
      />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[61] mt-1 px-3 py-1 rounded-full bg-amber-400 text-zinc-900 text-xs font-medium shadow-md pointer-events-none">
        {t("translation_edit.active_banner")}
      </div>
    </>
  );
}
