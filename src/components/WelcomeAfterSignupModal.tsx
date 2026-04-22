import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MailCheck } from "lucide-react";

interface Props {
  open: boolean;
  email: string | null;
  onClose: () => void;
}

/**
 * Visas EN gång direkt efter signup, innan bibliotek-rundturen startar.
 * Informerar användaren om att vi har skickat ett välkomst-/verifieringsmejl,
 * men släpper in personen direkt i biblioteket.
 */
export function WelcomeAfterSignupModal({ open, email, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-[440px] rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue/10">
            <MailCheck className="h-6 w-6 text-accent-blue" aria-hidden />
          </div>
          <DialogTitle className="font-display text-[22px] font-semibold tracking-tight text-center">
            Välkommen till Manuskort!
          </DialogTitle>
          <DialogDescription className="text-[14px] text-muted-foreground text-center leading-relaxed pt-1">
            Vi har skickat ett verifieringsmejl till
            {email ? <> <span className="text-foreground font-medium">{email}</span></> : <> din e-post</>}.
            Du kan börja använda Manuskort direkt — bekräfta gärna din e-post när det passar.
          </DialogDescription>
        </DialogHeader>

        <Button
          onClick={onClose}
          className="w-full h-11 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white font-medium text-[15px] mt-2"
        >
          Kom igång
        </Button>
      </DialogContent>
    </Dialog>
  );
}
