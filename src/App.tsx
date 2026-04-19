import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TourProvider } from "@/hooks/useTour";
import { TierProvider } from "@/hooks/useTier";
import { RequireAuth } from "@/components/RequireAuth";
import { EditorPreferenceProvider } from "@/hooks/useEditorPreference";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy-load tunga / sällan besökta sidor → mindre initial bundle
const Library = lazy(() => import("./pages/Library"));
const EditorRouter = lazy(() => import("./pages/EditorRouter"));
const EditorV1 = lazy(() => import("./pages/Editor"));
const EditorV2 = lazy(() => import("./pages/EditorV2"));
const EditorV3 = lazy(() => import("./pages/EditorV3"));
const Presentation = lazy(() => import("./pages/Presentation"));
const PrintView = lazy(() => import("./components/print/PrintView"));
const Settings = lazy(() => import("./pages/Settings"));
const Import = lazy(() => import("./pages/Import"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Admin = lazy(() => import("./pages/Admin"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const Moderator = lazy(() => import("./pages/usecase/Moderator"));
const Talare = lazy(() => import("./pages/usecase/Talare"));
const Panelsamtal = lazy(() => import("./pages/usecase/Panelsamtal"));
const Forelasning = lazy(() => import("./pages/usecase/Forelasning"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background" aria-hidden="true" />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TourProvider>
            <TierProvider>
              <EditorPreferenceProvider>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/aterstall-losenord" element={<ResetPassword />} />
                    <Route path="/priser" element={<Pricing />} />
                    <Route path="/moderator" element={<Moderator />} />
                    <Route path="/talare" element={<Talare />} />
                    <Route path="/panelsamtal" element={<Panelsamtal />} />
                    <Route path="/forelasning" element={<Forelasning />} />
                    <Route path="/bibliotek" element={<RequireAuth><Library /></RequireAuth>} />
                    <Route path="/installningar" element={<RequireAuth><Settings /></RequireAuth>} />
                    <Route path="/importera" element={<RequireAuth><Import /></RequireAuth>} />
                    <Route path="/manus/:id" element={<RequireAuth><EditorRouter /></RequireAuth>} />
                    <Route path="/manus/:id/v1" element={<RequireAuth><EditorV1 /></RequireAuth>} />
                    <Route path="/manus/:id/v2" element={<RequireAuth><EditorV2 /></RequireAuth>} />
                    <Route path="/manus/:id/v3" element={<RequireAuth><EditorV3 /></RequireAuth>} />
                    <Route path="/manus/:id/presentera" element={<RequireAuth><Presentation /></RequireAuth>} />
                    <Route path="/manus/:id/utskrift" element={<RequireAuth><PrintView /></RequireAuth>} />
                    <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
                    <Route path="/checkout/return" element={<CheckoutReturn />} />
                    <Route path="/index" element={<Navigate to="/bibliotek" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </EditorPreferenceProvider>
            </TierProvider>
          </TourProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
