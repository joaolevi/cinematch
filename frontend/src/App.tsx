import type { ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout, { Logo } from "./components/Layout";
import AboutPage from "./pages/AboutPage";
import AdminPage from "./pages/AdminPage";
import CommunityPage from "./pages/CommunityPage";
import DiaryPage from "./pages/DiaryPage";
import FeedPage from "./pages/FeedPage";
import HomePage from "./pages/HomePage";
import HowPage from "./pages/HowPage";
import LandingPage from "./pages/LandingPage";
import ListsPage from "./pages/ListsPage";
import LoginPage from "./pages/LoginPage";
import EpisodePage from "./pages/EpisodePage";
import TrackPage from "./pages/TrackPage";
import MediaPage from "./pages/MediaPage";
import OnboardingPage from "./pages/OnboardingPage";
import AccountPage from "./pages/AccountPage";
import TastePage from "./pages/TastePage";
import PeoplePage from "./pages/PeoplePage";
import ProfilePage from "./pages/ProfilePage";
import ActivityPage from "./pages/ActivityPage";
import SearchPage from "./pages/SearchPage";
import PrivacyPage from "./pages/PrivacyPage";

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

/** Páginas abertas a todos, como a política de privacidade: com o menu para quem entrou, sem ele para quem não. */
function Anyone() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Layout />;
  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:px-10">
      <header>
        <Link to="/bem-vindo" aria-label="Conhecer o Tastory" className="mb-8 inline-block">
          <Logo />
        </Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function RetroRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("aba", "retrospectiva");
  return <Navigate to={`/diario?${params}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/bem-vindo" element={<PublicOnly><LandingPage /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route element={<Anyone />}>
            <Route path="/privacidade" element={<PrivacyPage />} />
          </Route>
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<HomePage />} />
            <Route path="para-voce" element={<FeedPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="buscar" element={<SearchPage />} />
            <Route path="media/:id" element={<MediaPage />} />
            <Route path="media/:id/resenhas" element={<MediaPage />} />
            <Route path="media/:id/temporada/:season/episodio/:episode" element={<EpisodePage />} />
            <Route path="media/:id/faixa/:disc/:number" element={<TrackPage />} />
            <Route path="diario" element={<DiaryPage />} />
            {/* A retrospectiva virou uma aba do Diário; o endereço antigo leva para lá, com o período */}
            <Route path="retrospectiva" element={<RetroRedirect />} />
            <Route path="conta" element={<AccountPage />} />
            <Route path="meu-gosto" element={<TastePage />} />
            <Route path="listas" element={<ListsPage />} />
            <Route path="comunidade" element={<CommunityPage />} />
            <Route path="comunidade/pessoas" element={<PeoplePage />} />
            <Route path="pessoas/:id/:aba?" element={<ProfilePage />} />
            <Route path="atividade" element={<ActivityPage />} />
            <Route path="sobre" element={<AboutPage />} />
            <Route path="como-recomendamos" element={<HowPage />} />
            <Route path="admin" element={<RequireAuth admin><AdminPage /></RequireAuth>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
