import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPro: boolean;
}

export function DeleteAccountDialog({ open, onOpenChange, isPro }: Props) {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proBlockOpen, setProBlockOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Om användaren är PRO: visa spärr-dialog istället för formuläret.
  // Vi visar PRO-blocket när användaren öppnar dialogen som PRO.
  const showProBlock = isPro || proBlockOpen;

  const reset = () => {
    setConfirmation("");
    setPassword("");
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/installningar`,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Ingen portal-URL");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte öppna prenumerationsportalen");
    } finally {
      setPortalLoading(false);
    }
  };

  const onConfirmDelete = async () => {
    if (confirmation !== "RADERA") {
      toast.error("Skriv RADERA exakt för att bekräfta");
      return;
    }
    if (!password) {
      toast.error("Ange ditt lösenord");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation, password },
      });

      if (error) {
        // Edge function returnerar 403 med error: "active_subscription" om PRO är aktiv
        const ctx = (error as { context?: { body?: string } })?.context;
        let message = error.message ?? "Kunde inte radera kontot";
        if (ctx?.body) {
          try {
            const parsed = JSON.parse(ctx.body);
            if (parsed?.error === "active_subscription") {
              setProBlockOpen(true);
              return;
            }
            if (parsed?.error || parsed?.message) {
              message = parsed.message ?? parsed.error;
            }
          } catch { /* ignore */ }
        }
        toast.error(message);
        return;
      }

      if (data?.error === "active_subscription") {
        setProBlockOpen(true);
        return;
      }

      toast.success("Kontot är raderat");
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setSubmitting(false);
    }
  };

  // PRO-spärr — informerande dialog
  if (showProBlock) {
    return (
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setProBlockOpen(false);
            reset();
          }
          onOpenChange(o);
        }}
      >
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="font-display text-xl font-semibold text-center">
              Avsluta din prenumeration först
            </DialogTitle>
            <DialogDescription className="text-center text-[14px]">
              Du har en aktiv PRO-prenumeration. För att radera ditt konto måste du
              först avsluta prenumerationen, vänta tills perioden löpt ut, och sedan
              komma tillbaka hit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-col-reverse gap-2 sm:gap-2 sm:space-x-0">
            <Button
              variant="ghost"
              onClick={() => handleClose(false)}
              className="rounded-full w-full"
            >
              Avbryt
            </Button>
            <Button
              onClick={onManageSubscription}
              disabled={portalLoading}
              className="rounded-full w-full bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5"
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Hantera prenumeration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="rounded-2xl max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="font-display text-xl font-semibold text-center">
            Radera ditt konto permanent?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-[14px] text-muted-foreground text-center">
              <p>
                Detta tar bort <span className="font-medium text-foreground">alla dina manus, kort, paneldeltagare och din profil</span> för alltid.
                Åtgärden kan inte ångras.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-confirm" className="text-[13px] font-medium">
              Skriv <span className="font-mono text-foreground">RADERA</span> för att bekräfta
            </Label>
            <Input
              id="delete-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="RADERA"
              autoComplete="off"
              className="h-11 rounded-xl"
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-password" className="text-[13px] font-medium">
              Ditt lösenord
            </Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 rounded-xl"
              disabled={submitting}
            />
          </div>
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="rounded-full mt-0" disabled={submitting}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirmDelete();
            }}
            disabled={submitting || confirmation !== "RADERA" || !password}
            className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Radera kontot permanent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
