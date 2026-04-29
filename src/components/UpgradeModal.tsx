import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function UpgradeModal({
  open,
  onOpenChange,
  title,
  description,
}: UpgradeModalProps) {
  const { t } = useTranslation();
  const finalTitle = title ?? (t("upgrade_modal.title") as string);
  const finalDesc = description ?? (t("upgrade_modal.description") as string);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center font-display text-xl">{finalTitle}</DialogTitle>
          <DialogDescription className="text-center">{finalDesc}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
            {t("upgrade_modal.not_now")}
          </Button>
          <Button asChild className="rounded-full bg-accent-blue text-white hover:bg-accent-blue/90">
            <Link to="/priser" onClick={() => onOpenChange(false)}>
              {t("upgrade_modal.see_pro")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
