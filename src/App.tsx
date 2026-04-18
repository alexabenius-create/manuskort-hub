import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TourProvider } from "@/hooks/useTour";
import { TierProvider } from "@/hooks/useTier";
import { RequireAuth } from "@/components/RequireAuth";
import Library from "./pages/Library";
import Editor from "./pages/Editor";
import Presentation from "./pages/Presentation";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Import from "./pages/Import";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TourProvider>
            <TierProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/priser" element={<Pricing />} />
                <Route path="/" element={<RequireAuth><Library /></RequireAuth>} />
                <Route path="/installningar" element={<RequireAuth><Settings /></RequireAuth>} />
                <Route path="/importera" element={<RequireAuth><Import /></RequireAuth>} />
                <Route path="/manus/:id" element={<RequireAuth><Editor /></RequireAuth>} />
                <Route path="/manus/:id/presentera" element={<RequireAuth><Presentation /></RequireAuth>} />
                <Route path="/index" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TierProvider>
          </TourProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
