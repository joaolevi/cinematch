import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Layout";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = isLogin ? await login(email, password) : await register(name, email, password);
      nav(u.onboarded ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form className="card w-full max-w-sm space-y-4 p-6" onSubmit={submit}>
        <div>
          <Logo />
          <p className="mt-1 text-sm text-muted">A história do seu gosto.</p>
        </div>
        {!isLogin && (
          <label className="block text-sm font-medium">
            Nome
            <input className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="block text-sm font-medium">
          E-mail
          <input
            className="input mt-1.5"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input
            className="input mt-1.5"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isLogin ? undefined : 6}
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Aguarde…" : isLogin ? "Entrar" : "Criar conta"}
        </button>
        <p className="text-center text-sm text-muted">
          {isLogin ? (
            <>
              Não tem conta?{" "}
              <Link to="/cadastro" className="text-accent hover:underline">
                Cadastre-se
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <Link to="/login" className="text-accent hover:underline">
                Entrar
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
