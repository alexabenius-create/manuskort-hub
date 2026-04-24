import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TourProvider } from "@/hooks/useTour";
import { TierProvider } from "@/hooks/useTier";
import { RequireAuth } from "@/components/RequireAuth";
import { usePresence } from "@/hooks/usePresence";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const LandingV2 = lazy(() => import("./pages/LandingV2"));

// Lazy-load tunga / sällan besökta sidor → mindre initial bundle
const Library = lazy(() => import("./pages/Library"));
const LibraryV2 = lazy(() => import("./pages/LibraryV2"));
const EditorV3 = lazy(() => import("./pages/EditorV3"));
const EditorV4 = lazy(() => import("./pages/EditorV4"));
const Presentation = lazy(() => import("./pages/Presentation"));
const PrintView = lazy(() => import("./components/print/PrintView"));
const Settings = lazy(() => import("./pages/Settings"));
const Import = lazy(() => import("./pages/Import"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Admin = lazy(() => import("./pages/Admin"));
const Messages = lazy(() => import("./pages/Messages"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const Moderator = lazy(() => import("./pages/usecase/Moderator"));
const Talare = lazy(() => import("./pages/usecase/Talare"));
const Panelsamtal = lazy(() => import("./pages/usecase/Panelsamtal"));
const Forelasning = lazy(() => import("./pages/usecase/Forelasning"));
const AffiliateLanding = lazy(() => import("./pages/AffiliateLanding"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background" aria-hidden="true" />
);

/**
 * Legacy editor-routes (/v1, /v2, /v3) redirect:as till /manus/:id.
 * v1/v2 är utfasade sedan 2026-04-19 — v3 är enda aktiva editorn.
 */
const LegacyEditorRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/manus/${id}`} replace />;
};

const PresenceTracker = () => {
  usePresence();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PresenceTracker />
          <TourProvider>
            <TierProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/v2" element={<LandingV2 />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/aterstall-losenord" element={<ResetPassword />} />
                  <Route path="/priser" element={<Pricing />} />
                  <Route path="/moderator" element={<Moderator />} />
                  <Route path="/talare" element={<Talare />} />
                  <Route path="/panelsamtal" element={<Panelsamtal />} />
                  <Route path="/forelasning" element={<Forelasning />} />
                  <Route path="/affiliate/:code" element={<AffiliateLanding />} />
                  <Route path="/bibliotek" element={<RequireAuth><Library /></RequireAuth>} />
                  <Route path="/bibliotek-v2" element={<RequireAuth><LibraryV2 /></RequireAuth>} />
                  <Route path="/installningar" element={<RequireAuth><Settings /></RequireAuth>} />
                  <Route path="/importera" element={<RequireAuth><Import /></RequireAuth>} />
                  <Route path="/manus/:id" element={<RequireAuth><EditorV3 /></RequireAuth>} />
                  {/* Legacy editor-routes — redirect:ar till v3. Tas bort i samma migration som filerna raderas. */}
                  <Route path="/manus/:id/v1" element={<RequireAuth><LegacyEditorRedirect /></RequireAuth>} />
                  <Route path="/manus/:id/v2" element={<RequireAuth><LegacyEditorRedirect /></RequireAuth>} />
                  <Route path="/manus/:id/v3" element={<RequireAuth><LegacyEditorRedirect /></RequireAuth>} />
                  <Route path="/manus/:id/v4" element={<RequireAuth><EditorV4 /></RequireAuth>} />
                  <Route path="/manus/:id/presentera" element={<RequireAuth><Presentation /></RequireAuth>} />
                  <Route path="/manus/:id/utskrift" element={<RequireAuth><PrintView /></RequireAuth>} />
                  <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
                  <Route path="/meddelanden" element={<RequireAuth><Messages /></RequireAuth>} />
                  <Route path="/checkout/return" element={<CheckoutReturn />} />
                  <Route path="/index" element={<Navigate to="/bibliotek" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </TierProvider>
          </TourProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
