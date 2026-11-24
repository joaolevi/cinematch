import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ExperimentsToggle from "../components/ExperimentsToggle";
import type { StreamingService, Visibility } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

function Part({ title, children, tape = 0, id }: { title: string; children: ReactNode; tape?: number; id?: string }) {
  return (
    <section id={id} className="paper relative -rotate-[0.2deg] scroll-mt-24 rounded-sm py-6 pr-6 pl-14 text-[#2b211c] sm:pl-16">
      <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[tape] }} />
      <h2 className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">{title}</h2>
      <div className="mt-1 space-y-2 text-sm leading-6">{children}</div>
    </section>
  );
}

const VISIBILITY: [Visibility, string, string][] = [
  ["all", "Todos", "Quem tem conta vê os seus registros na Comunidade, no seu perfil e nas resenhas."],
  ["followers", "Quem me segue", "Só quem segue você vê. Seguir não pede aceite: para esconder de todo mundo, use Só eu."],
  ["private", "Só eu", "Ninguém vê os seus registros, e o seu perfil some para as outras pessoas."],
];

/** Quem vê os meus registros (RFF10). */
function VisibilityPicker() {
  const { user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const current = VISIBILITY.find(([key]) => key === user.visibility) ?? VISIBILITY[0];
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quem vê meus registros">
        {VISIBILITY.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={user.visibility === key}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await api.setVisibility(key);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${
              user.visibility === key ? "border-[#b9452f] bg-[#b9452f] text-white" : "border-stone-400 hover:border-[#b9452f]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2">{current[2]}</p>
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}

/** Os serviços que eu assino (RFF21): o Para você filtra por eles e avisa onde cada título está. */
function ServicesPicker() {
  const { user, refresh } = useAuth();
  const [options, setOptions] = useState<StreamingService[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.services().then(setOptions).catch((e) => setError((e as Error).message));
  }, []);
  if (!user) return null;
  const mine = new Set(user.services);
  async function toggle(key: string) {
    const next = mine.has(key) ? user!.services.filter((k) => k !== key) : [...user!.services, key];
    setSaving(true);
    setError(null);
    try {
      await api.setServices(next);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Meus serviços">
        {options.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={mine.has(s.key)}
            disabled={saving}
            onClick={() => toggle(s.key)}
            title={s.count === 1 ? "1 título do catálogo está aqui" : `${s.count} títulos do catálogo estão aqui`}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${
              mine.has(s.key) ? "border-[#b9452f] bg-[#b9452f] text-white" : "border-stone-400 hover:border-[#b9452f]"
            }`}
          >
            {mine.has(s.key) ? "✓ " : ""}
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs opacity-80">
        {user.services.length === 0
          ? "Nenhum serviço marcado ainda."
          : user.services.length === 1
            ? "1 serviço marcado."
            : `${user.services.length} serviços marcados.`}{" "}
        Onde assistir vem da JustWatch, pelo TMDB, e vale só para a assinatura: aluguel e compra não contam.
      </p>
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}

/** Minha conta: dados, quem vê, serviços, experimentos e excluir a conta (RFF06, RFF10, RFF17, RFF21). */
export default function AccountPage() {
  usePageTitle("Minha conta");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { hash } = useLocation();
  // Links como /conta#servicos levam direto à parte certa
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  if (!user) return null;

  async function download() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `tastory-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function remove(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMyAccount(password);
      logout();
      navigate("/bem-vindo");
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Minha conta</h1>
        <p className="mt-1 text-muted">
          {user.name} · {user.email}
        </p>
      </div>

      <Part title="Meus dados" tape={0}>
        <p>
          Baixe tudo o que o Tastory guarda sobre você, num arquivo JSON: o diário com notas e resenhas, as listas, as
          preferências do começo, quem você segue e as sugestões que você viu e o que fez com elas. A senha não vai junto.
        </p>
        <button className="btn-primary mt-2" disabled={exporting} onClick={download}>
          {exporting ? "Juntando seus dados..." : "Baixar meus dados"}
        </button>
        {exportError && <p className="text-red-700">{exportError}</p>}
      </Part>

      <Part title="Quem vê meus registros" tape={1} id="quem-ve">
        <VisibilityPicker />
      </Part>

      <Part title="Meus serviços" tape={0} id="servicos">
        <p>
          Marque o que você assina. No Para você, "Só nos meus serviços" e "Hoje à noite" mostram só o que dá para ver
          agora, e cada sugestão avisa se está num serviço seu.
        </p>
        <ServicesPicker />
      </Part>

      <Part title="Experimentos" tape={2}>
        <p>
          Comparamos duas formas de sugerir filmes e séries. Saiba mais em{" "}
          <Link to="/como-recomendamos" className="underline hover:text-[#b9452f]">
            Como recomendamos
          </Link>
          . Participar é uma escolha sua, como explica a{" "}
          <Link to="/privacidade" className="underline hover:text-[#b9452f]">
            política de privacidade
          </Link>
          .
        </p>
        <ExperimentsToggle />
      </Part>

      <Part title="Excluir minha conta" tape={1}>
        {user.role === "admin" ? (
          <p>Contas de administração não podem ser excluídas por aqui.</p>
        ) : (
          <form onSubmit={remove} className="space-y-3">
            <p>
              Apaga a conta e tudo o que é dela: diário, listas, preferências, quem você segue e o histórico de
              sugestões. Não dá para desfazer. Se quiser guardar alguma coisa, baixe seus dados antes.
            </p>
            <label className="block">
              <span className="font-semibold">Para confirmar, digite sua senha</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full max-w-xs rounded-md border border-stone-400 bg-white/70 px-3 py-2 text-[#2b211c]"
              />
            </label>
            <button type="submit" className="btn-primary bg-[#b42318]! text-white!" disabled={deleting || !password}>
              {deleting ? "Excluindo..." : "Excluir minha conta"}
            </button>
            {deleteError && <p className="text-red-700">{deleteError}</p>}
          </form>
        )}
      </Part>
    </div>
  );
}
