import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  /** Innehållet som renderas i panelen — typ. en stack av länkar/knappar. */
  children: ReactNode;
  /** Skärmläsar-titel; default "Meny". */
  title?: string;
  /** Extra klass på trigger-knappen. */
  className?: string;
}

/**
 * MobileNavSheet — hamburger-trigger + höger-Sheet med navigering.
 * Endast synlig på mobil (md:hidden). Stänger automatiskt vid klick på länk.
 */
export function MobileNavSheet({ children, title, className }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const sheetTitle = title ?? t("nav.menu");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("nav.open_menu")}
          className={
            "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-surface-2 transition-colors " +
            (className ?? "")
          }
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[82%] max-w-sm flex flex-col gap-6 pt-14">
        <SheetHeader>
          <SheetTitle className="font-display text-[20px] font-semibold tracking-tight text-left">
            {sheetTitle}
          </SheetTitle>
        </SheetHeader>
        <nav
          className="flex flex-col gap-1"
          onClick={(e) => {
            // Stäng vid klick på länk/knapp i menyn
            const target = e.target as HTMLElement;
            if (target.closest("a, button")) setOpen(false);
          }}
        >
          {children}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
