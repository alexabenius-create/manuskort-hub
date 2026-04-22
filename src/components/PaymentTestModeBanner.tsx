const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
      Alla betalningar i preview körs i testläge.
    </div>
  );
}
