import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-faint uppercase tracking-widest">Laddar…</p>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" state={{ from: loc }} replace />;
  return children;
}
