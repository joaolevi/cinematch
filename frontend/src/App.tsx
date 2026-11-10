import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import AboutPage from "./pages/AboutPage";
import AdminPage from "./pages/AdminPage";
import CommunityPage from "./pages/CommunityPage";
import DiaryPage from "./pages/DiaryPage";
import FeedPage from "./pages/FeedPage";
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import ListsPage from "./pages/ListsPage";
import LoginPage from "./pages/LoginPage";
import MediaPage from "./pages/MediaPage";
import OnboardingPage from "./pages/OnboardingPage";
import SearchPage from "./pages/SearchPage";

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-muted">Carregando...</p>;
  if (!user) return <Navigate to="/bem-vindo" replace />; // quem não entrou conhece o sistema antes
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <>{children}</>;
  // Único ponto que decide para onde vai quem acabou de entrar
  const home = user.onboarded || user.role === "admin" ? "/" : "/onboarding";
  return <Navigate to={home} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/bem-vindo" element={<PublicOnly><LandingPage /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<HomePage />} />
            <Route path="para-voce" element={<FeedPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="buscar" element={<SearchPage />} />
            <Route path="media/:id" element={<MediaPage />} />
            <Route path="diario" element={<DiaryPage />} />
            <Route path="listas" element={<ListsPage />} />
            <Route path="comunidade" element={<CommunityPage />} />
            <Route path="sobre" element={<AboutPage />} />
            <Route path="admin" element={<RequireAuth admin><AdminPage /></RequireAuth>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
