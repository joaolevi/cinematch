import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { Logo } from "../components/Layout";
import PolaroidCollage from "../components/PolaroidCollage";
import { TAPE_COLORS, tabColor } from "../ui";
import { usePageTitle } from "../usePageTitle";

// As contas de demonstração só aparecem em desenvolvimento ou quando o build pede
const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true";

export default function LoginPage() {
  usePageTitle("Entrar");
  const { login, register } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(params.get("modo") === "cadastro" ? "register" : "login");
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
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(kind: "demo" | "admin") {
    setMode("login");
    setEmail(kind === "demo" ? "demo@tastory.dev" : "admin@tastory.dev");
    setPassword(kind === "demo" ? "demo123" : "admin123");
  }

  const hand = "block font-hand text-xl leading-6 font-bold";
  return (
    // Fundo escuro, como a apresentação: o diário de exemplo de um lado e a folha do login do outro
    <div className="mx-auto flex min-h-screen max-w-[1680px] items-center justify-center gap-16 px-4 py-10 sm:px-6 lg:px-10">
      <div className="hidden max-w-2xl flex-1 lg:block">
        <p className="font-hand text-3xl font-bold text-accent">Querido diário,</p>
        <p className="mb-8 font-display text-4xl leading-tight font-bold">
          hoje eu vi um filme e quero <span className="text-accent">guardar</span> o que senti.
        </p>
        <PolaroidCollage count={4}>
          <span className="absolute right-[2%] bottom-[14%] z-10 rotate-[-10deg] rounded-xl border-4 border-accent px-4 py-1 font-display text-3xl font-bold text-accent">
            Visto!
          </span>
        </PolaroidCollage>
      </div>

      <div className="w-full max-w-sm shrink-0">
        {/* Entrar e Criar conta são abas de caderno presas no alto da folha */}
        <div className="-rotate-[0.5deg]">
          <div role="tablist" aria-label="Entrar ou criar conta" className="flex gap-1 pl-12">
            {(["login", "register"] as const).map((m, position) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className="nb-tab on-paper"
                style={tabColor(position * 2)}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>
          <div className="paper desk-bar relative w-full rounded-sm rounded-tl-none py-7 pr-6 pl-14">
            <span aria-hidden className="tape -top-2.5 right-6 rotate-6" style={{ background: TAPE_COLORS[2] }} />
            <div className="mb-5 text-center">
              <Link to="/bem-vindo" aria-label="Conhecer o Tastory">
                <Logo />
              </Link>
              <p className="font-hand text-2xl leading-7 font-bold text-[#b9452f]">a história do seu gosto</p>
            </div>
            {/* Tinta escura, para não competir com o slogan em vermelho */}
            <p className="mb-3 font-hand text-2xl leading-8 font-bold text-[#2b211c]">
              {mode === "login" ? "Que bom te ver de novo!" : "Vamos começar o seu diário?"}
            </p>

            <form onSubmit={submit} className="space-y-3">
              {mode === "register" && (
                <label className={hand}>
                  Nome
                  <input
                    className="input mt-1 font-sans text-sm font-normal"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
              )}
              <label className={hand}>
                E-mail
                <input
                  className="input mt-1 font-sans text-sm font-normal"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className={hand}>
                Senha
                <input
                  className="input mt-1 font-sans text-sm font-normal"
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 6 : 1}
                  maxLength={mode === "register" ? 72 : undefined}
                />
              </label>
              {mode === "register" && (
                <ul className="font-hand text-lg leading-6 font-semibold opacity-80">
                  <li>→ A senha precisa ter pelo menos 6 caracteres.</li>
                  <li>→ O que você marcar como Já vi aparece na Comunidade, para quem tem conta.</li>
                </ul>
              )}
              {error && <p className="text-sm font-semibold text-[#b42318]">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>
          </div>
        </div>

        {SHOW_DEMO_ACCOUNTS && (
          <div className="mt-5 text-center text-xs text-muted">
            Contas de demonstração:{" "}
            <button className="cursor-pointer text-accent underline" onClick={() => fillDemo("demo")}>
              usuário demo
            </button>{" "}
            ou{" "}
            <button className="cursor-pointer text-accent underline" onClick={() => fillDemo("admin")}>
              administrador
            </button>
          </div>
        )}
        <p className="mt-6 text-center">
          <Link to="/bem-vindo" className="font-hand text-xl font-bold text-accent underline">
            ← Conhecer o Tastory
          </Link>
        </p>
      </div>
    </div>
  );
}
