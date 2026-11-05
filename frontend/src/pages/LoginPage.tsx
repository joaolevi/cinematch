import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Logo } from "../components/Layout";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const user = await login(email, password);
        navigate(user.onboarded || user.role === "admin" ? "/" : "/onboarding");
      } else {
        await register(name, email, password);
        navigate("/onboarding");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(kind: "demo" | "admin") {
    setMode("login");
    setEmail(kind === "demo" ? "demo@cinematch.dev" : "admin@cinematch.dev");
    setPassword(kind === "demo" ? "demo123" : "admin123");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo />
          <p className="mt-2 text-sm text-muted">O diário que sabe o que você vai querer ver depois.</p>
        </div>

        <div className="card p-6">
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-bg p-1 text-sm">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                className={`cursor-pointer rounded-md py-1.5 font-semibold ${mode === m ? "bg-surface-2 text-accent" : "text-muted"}`}
                onClick={() => setMode(m)}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <input className="input" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            )}
            <input className="input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              className="input"
              type="password"
              placeholder="Senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 6 : 1}
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center text-xs text-muted">
          Contas de demonstração:{" "}
          <button className="cursor-pointer text-accent underline" onClick={() => fillDemo("demo")}>
            usuário demo
          </button>{" "}
          ·{" "}
          <button className="cursor-pointer text-accent underline" onClick={() => fillDemo("admin")}>
            administrador
          </button>
        </div>
      </div>
    </div>
  );
}
