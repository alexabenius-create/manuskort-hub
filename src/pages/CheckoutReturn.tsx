import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-surface rounded-2xl shadow-card p-8 flex flex-col items-center text-center gap-5">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
          <Check className="h-6 w-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {sessionId ? "Tack för din betalning!" : "Ingen betalningsinformation"}
          </h1>
          <p className="text-[14px] text-muted-foreground">
            {sessionId
              ? "Din PRO-prenumeration aktiveras inom kort. Du får ett kvitto via e-post."
              : "Vi hittade ingen aktiv checkout-session."}
          </p>
        </div>
        <Button asChild className="rounded-full w-full">
          <Link to="/bibliotek">Till biblioteket</Link>
        </Button>
      </div>
    </div>
  );
}
