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
import NotFound from "./pages/NotFound";

// V2 är default sedan 2026-04-24. v1-sidor ligger kvar som alias (-v1-suffix saknas;
// gamla filer behålls 1-2 veckor som backup innan radering enligt cutover-plan.)
const Landing = lazy(() => import("./pages/LandingV2"));
const Auth = lazy(() => import("./pages/AuthV2"));
const ResetPassword = lazy(() => import("./pages/ResetPasswordV2"));
const Library = lazy(() => import("./pages/LibraryV2"));
const Editor = lazy(() => import("./pages/EditorV4"));
const Settings = lazy(() => import("./pages/SettingsV2"));
const Import = lazy(() => import("./pages/ImportV2"));
const Pricing = lazy(() => import("./pages/PricingV2"));
const DebattBuddy = lazy(() => import("./pages/DebattBuddy"));
const Admin = lazy(() => import("./pages/AdminV2"));
const Messages = lazy(() => import("./pages/MessagesV2"));
const Moderator = lazy(() => import("./pages/usecase/ModeratorV2"));
const Talare = lazy(() => import("./pages/usecase/TalareV2"));
const Panelsamtal = lazy(() => import("./pages/usecase/PanelsamtalV2"));
const Forelasning = lazy(() => import("./pages/usecase/ForelasningV2"));
const AffiliateLanding = lazy(() => import("./pages/AffiliateLandingV2"));

// Alias-routes (-v2-suffix) renderar samma V2-komponenter — behålls tills v1-filer raderas.
const LandingV2 = Landing;
const AuthV2 = Auth;
const ResetPasswordV2 = ResetPassword;
const LibraryV2 = Library;
const SettingsV2 = Settings;
const ImportV2 = Import;
const PricingV2 = Pricing;
const AdminV2 = Admin;
const MessagesV2 = Messages;
const ModeratorV2 = Moderator;
const TalareV2 = Talare;
const PanelsamtalV2 = Panelsamtal;
const ForelasningV2 = Forelasning;
const AffiliateLandingV2 = AffiliateLanding;

// Specialvyer — egen estetik, behåller v1.
const Presentation = lazy(() => import("./pages/Presentation"));
const PrintView = lazy(() => import("./components/print/PrintView"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));

// Legacy editor-filer (EditorV3) ligger kvar som backup men routas inte längre.
const EditorV4 = Editor;

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
                  <Route path="/auth-v2" element={<AuthV2 />} />
                  <Route path="/aterstall-losenord" element={<ResetPassword />} />
                  <Route path="/aterstall-losenord-v2" element={<ResetPasswordV2 />} />
                  <Route path="/priser" element={<Pricing />} />
                  <Route path="/priser-v2" element={<PricingV2 />} />
                  <Route path="/moderator" element={<Moderator />} />
                  <Route path="/moderator-v2" element={<ModeratorV2 />} />
                  <Route path="/talare" element={<Talare />} />
                  <Route path="/talare-v2" element={<TalareV2 />} />
                  <Route path="/panelsamtal" element={<Panelsamtal />} />
                  <Route path="/panelsamtal-v2" element={<PanelsamtalV2 />} />
                  <Route path="/forelasning" element={<Forelasning />} />
                  <Route path="/forelasning-v2" element={<ForelasningV2 />} />
                  <Route path="/affiliate/:code" element={<AffiliateLanding />} />
                  <Route path="/affiliate-v2/:code" element={<AffiliateLandingV2 />} />
                  <Route path="/bibliotek" element={<RequireAuth><Library /></RequireAuth>} />
                  <Route path="/bibliotek-v2" element={<RequireAuth><LibraryV2 /></RequireAuth>} />
                  <Route path="/installningar" element={<RequireAuth><Settings /></RequireAuth>} />
                  <Route path="/importera" element={<RequireAuth><Import /></RequireAuth>} />
                  <Route path="/importera-v2" element={<RequireAuth><ImportV2 /></RequireAuth>} />
                  <Route path="/manus/:id" element={<RequireAuth><Editor /></RequireAuth>} />
                  {/* Legacy editor-routes — redirect:ar till default-editorn (V4). */}
                  <Route path="/manus/:id/v1" element={<RequireAuth><LegacyEditorRedirect /></RequireAuth>} />
                  <Route path="/manus/:id/v2" element={<RequireAuth><LegacyEditorRedirect /></RequireAuth>} />
                  <Route path="/manus/:id/v3" element={<RequireAuth><LegacyEditorRedirect /></RequireAuth>} />
                  <Route path="/manus/:id/v4" element={<RequireAuth><EditorV4 /></RequireAuth>} />
                  <Route path="/manus/:id/presentera" element={<RequireAuth><Presentation /></RequireAuth>} />
                  <Route path="/manus/:id/utskrift" element={<RequireAuth><PrintView /></RequireAuth>} />
                  <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
                  <Route path="/admin-v2" element={<RequireAuth><AdminV2 /></RequireAuth>} />
                  <Route path="/installningar-v2" element={<RequireAuth><SettingsV2 /></RequireAuth>} />
                  <Route path="/meddelanden" element={<RequireAuth><Messages /></RequireAuth>} />
                  <Route path="/meddelanden-v2" element={<RequireAuth><MessagesV2 /></RequireAuth>} />
                  <Route path="/debatt-buddy" element={<RequireAuth><DebattBuddy /></RequireAuth>} />
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
