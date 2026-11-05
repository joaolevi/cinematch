import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import AdminPage from "./pages/AdminPage";
import DiaryPage from "./pages/DiaryPage";
import FeedPage from "./pages/FeedPage";
import ListsPage from "./pages/ListsPage";
import LoginPage from "./pages/LoginPage";
import MediaPage from "./pages/MediaPage";
import OnboardingPage from "./pages/OnboardingPage";
import SearchPage from "./pages/SearchPage";

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-muted">Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<FeedPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="buscar" element={<SearchPage />} />
            <Route path="media/:id" element={<MediaPage />} />
            <Route path="diario" element={<DiaryPage />} />
            <Route path="listas" element={<ListsPage />} />
            <Route path="admin" element={<RequireAuth admin><AdminPage /></RequireAuth>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
