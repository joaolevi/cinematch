import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import Diary from "./pages/Diary";
import Feed from "./pages/Feed";
import Lists from "./pages/Lists";
import MediaDetailPage from "./pages/MediaDetailPage";
import Onboarding from "./pages/Onboarding";
import Search from "./pages/Search";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-center text-muted">Carregando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function OnboardingGate() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-center text-muted">Carregando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.onboarded) return <Navigate to="/" replace />;
  return <Onboarding />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/cadastro" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/onboarding" element={<OnboardingGate />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Feed />} />
        <Route path="/buscar" element={<Search />} />
        <Route path="/titulo/:id" element={<MediaDetailPage />} />
        <Route path="/diario" element={<Diary />} />
        <Route path="/listas" element={<Lists />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
