import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { getHelpForRoute } from "@/lib/helpContent";
import { useTour } from "@/hooks/useTour";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpSheet({ open, onOpenChange }: Props) {
  const { pathname } = useLocation();
  const entry = getHelpForRoute(pathname);
  const { resetTour } = useTour();
  const { t } = useTranslation();

  if (!entry) return null;

  const handleReplayTour = async () => {
    if (!entry.tourId) return;
    await resetTour(entry.tourId);
    onOpenChange(false);
    toast.success(t("help.tour_will_replay"));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] overflow-y-auto"
      >
        <SheetHeader className="space-y-2 mb-6">
          <SheetTitle className="font-display text-2xl font-semibold tracking-tight">
            {entry.title}
          </SheetTitle>
          {entry.intro && (
            <SheetDescription className="text-[14px] leading-[1.55] text-muted-foreground">
              {entry.intro}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-5">
          {entry.sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-1.5">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="text-[13.5px] leading-[1.6] text-muted-foreground">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        {entry.tourId && (
          <div className="mt-8 pt-6 border-t border-border/50">
            <Button
              variant="ghost"
              onClick={handleReplayTour}
              className="rounded-full text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2 gap-1.5 w-full justify-start"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("help.replay_tour")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
