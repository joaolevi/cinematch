import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Avatar } from "../components/WatchedBy";
import { refreshAvatars } from "../avatars";
import type { LetterboxdResult, StreamingService, Visibility } from "../types";
import { usePageTitle } from "../usePageTitle";

function Part({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    // Cartão escuro com o título à mão: a conta é um lugar de ajustes, sem papel colado
    <section id={id} className="card scroll-mt-24 p-6">
      <h2 className="font-hand text-2xl leading-8 font-bold text-accent">{title}</h2>
      <div className="mt-1 space-y-2 text-sm leading-6">{children}</div>
    </section>
  );
}

const FIELD = "input mt-1 block w-full max-w-sm";

/** Reduz a foto a um quadrado de 256 px, cortando as sobras do centro, e devolve como JPEG. */
async function squarePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** O que as outras pessoas veem de mim: a foto, o nome e o e-mail da conta, e a senha. */
function ProfileEditor() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<"foto" | "dados" | "senha" | null>(null);
  const [message, setMessage] = useState<{ part: "foto" | "dados" | "senha"; text: string; error?: boolean } | null>(null);
  if (!user) return null;

  async function run(part: "foto" | "dados" | "senha", action: () => Promise<unknown>, done: string) {
    setBusy(part);
    setMessage(null);
    try {
      await action();
      setMessage({ part, text: done });
    } catch (e) {
      setMessage({ part, text: (e as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  }

  const note = (part: "foto" | "dados" | "senha") =>
    message?.part === part && (
      <p role="status" className={message.error ? "text-red-700" : "text-[#4f7a5c]"}>
        {message.text}
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={user.name} userId={user.id} size="h-20 w-20 text-3xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              id="foto-de-perfil"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="peer sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  run("foto", async () => {
                    await api.setAvatar(await squarePhoto(file));
                    await refreshAvatars();
                  }, "Foto trocada.");
              }}
            />
            <label
              htmlFor="foto-de-perfil"
              className="btn-primary cursor-pointer px-4 py-1.5 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
            >
              {busy === "foto" ? "Enviando..." : "Escolher uma foto"}
            </label>
            <button
              type="button"
              className="btn-ghost px-4 py-1.5 text-sm"
              disabled={busy !== null}
              onClick={() =>
                run("foto", async () => {
                  await api.removeAvatar();
                  await refreshAvatars();
                }, "Foto retirada: volta a inicial do nome.")
              }
            >
              Tirar a foto
            </button>
          </div>
          <p className="text-xs text-muted">
            A foto aparece no seu perfil, na Comunidade e nas resenhas.{" "}
            <Link to={`/pessoas/${user.id}`} className="underline hover:text-accent">
              Ver meu perfil como os outros veem
            </Link>
          </p>
          {note("foto")}
        </div>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run("dados", async () => {
            await api.editAccount({ name: name.trim(), email: email.trim() });
            await refresh();
          }, "Nome e e-mail salvos.");
        }}
      >
        <label className="block">
          <span className="font-semibold">Nome</span>
          <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="font-semibold">E-mail</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
        </label>
        <button className="btn-primary" disabled={busy !== null || (name.trim() === user.name && email.trim() === user.email)}>
          {busy === "dados" ? "Salvando..." : "Salvar nome e e-mail"}
        </button>
        {note("dados")}
      </form>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run("senha", async () => {
            await api.changePassword(current, next);
            setCurrent("");
            setNext("");
          }, "Senha trocada.");
        }}
      >
        <label className="block">
          <span className="font-semibold">Senha atual</span>
          <input required type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="font-semibold">Nova senha</span>
          <input required minLength={6} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={FIELD} />
          <span className="text-xs text-muted">Pelo menos 6 caracteres.</span>
        </label>
        <button className="btn-primary" disabled={busy !== null || !current || next.length < 6}>
          {busy === "senha" ? "Trocando..." : "Trocar a senha"}
        </button>
        {note("senha")}
      </form>
    </div>
  );
}

const LETTERBOXD_FILES = ["watched.csv", "ratings.csv", "diary.csv", "reviews.csv", "watchlist.csv"];

/** Trazer o histórico do Letterboxd (RFF18), pelos CSVs do arquivo que a pessoa exporta de lá. */
function LetterboxdImport() {
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<LetterboxdResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const contents = await Promise.all(files.map(async (f) => ({ name: f.name, content: await f.text() })));
      setResult(await api.importLetterboxd(contents));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <form onSubmit={send} className="space-y-2">
      <p>
        No Letterboxd, vá em Settings, Data e Export your data. Descompacte o arquivo e escolha os CSVs que quer trazer:{" "}
        {LETTERBOXD_FILES.join(", ")}. O que já está no seu diário fica como está, e as resenhas seguem quem vê os seus
        registros.
      </p>
      {/* O campo de arquivo do navegador fala inglês em alguns sistemas: ele fica escondido, e o botão é nosso */}
      <div>
        <p className="font-semibold">Arquivos do Letterboxd</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <input
            id="letterboxd-arquivos"
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []));
              setResult(null);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor="letterboxd-arquivos"
            className="btn-ghost cursor-pointer px-4 py-1.5 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
          >
            Escolher arquivos CSV
          </label>
          <span className="text-sm">
            {files.length ? files.map((f) => f.name).join(", ") : "Nenhum arquivo escolhido"}
          </span>
        </div>
      </div>
      <button className="btn-primary" disabled={sending || files.length === 0}>
        {sending ? "Procurando os filmes..." : "Trazer do Letterboxd"}
      </button>
      <div aria-live="polite">
        {error && <p className="text-red-700">{error}</p>}
        {result && (
          <div className="space-y-1">
            <p>
              {plural(result.registered, "filme entrou", "filmes entraram")} no diário e{" "}
              {plural(result.want_to_watch, "no Quero ver", "no Quero ver")}.
              {result.already_in_diary > 0 && ` ${plural(result.already_in_diary, "já estava", "já estavam")} no diário.`}
              {result.brought > 0 && ` ${plural(result.brought, "filme novo veio", "filmes novos vieram")} do TMDB para o catálogo.`}
            </p>
            {result.next_time > 0 && (
              <p>
                {plural(result.next_time, "filme ficou", "filmes ficaram")} para o próximo envio: envie os mesmos arquivos de
                novo para trazer.
              </p>
            )}
            {result.not_found_total > 0 && (
              <p>
                Não achamos {plural(result.not_found_total, "filme", "filmes")}: {result.not_found.join(", ")}
                {result.not_found_total > result.not_found.length && " e outros"}. Dá para procurar cada um na Busca.
              </p>
            )}
            {result.ignored_files.length > 0 && <p>Arquivos que não usamos: {result.ignored_files.join(", ")}.</p>}
            <Link to="/diario" className="underline hover:text-accent">
              Ver meu diário
            </Link>
          </div>
        )}
      </div>
    </form>
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
              user.visibility === key ? "border-accent bg-accent text-bg" : "border-line hover:border-accent"
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
              mine.has(s.key) ? "border-accent bg-accent text-bg" : "border-line hover:border-accent"
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

/** Minha conta: dados, quem vê, serviços e excluir a conta (RFF06, RFF10, RFF21). */
type Tab = "perfil" | "privacidade" | "servicos" | "dados";
const TABS: [Tab, string][] = [
  ["perfil", "Perfil"],
  ["privacidade", "Privacidade"],
  ["servicos", "Serviços"],
  ["dados", "Meus dados"],
];
// O endereço escolhe a aba: as abas e as partes que já tinham link (#quem-ve, #letterboxd...)
const TAB_OF_HASH: Record<string, Tab> = {
  perfil: "perfil",
  privacidade: "privacidade",
  "quem-ve": "privacidade",
  servicos: "servicos",
  dados: "dados",
  letterboxd: "dados",
};

export default function AccountPage() {
  usePageTitle("Minha conta");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const tab = TAB_OF_HASH[hash.slice(1)] ?? "perfil";
  const openTab = (key: Tab) => navigate({ hash: key }, { replace: true });
  // Links como /conta#servicos abrem a aba certa e levam direto à parte
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

      {/* Quatro abas, para a página não virar uma pilha de oito folhas */}
      <div role="tablist" aria-label="Partes da conta" className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            id={`aba-${key}`}
            aria-selected={tab === key}
            aria-controls="painel-da-conta"
            onClick={() => openTab(key)}
            className={`chip cursor-pointer px-4 py-1.5 text-sm ${tab === key ? "border-accent bg-accent/15 text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="painel-da-conta" role="tabpanel" aria-labelledby={`aba-${tab}`} className="space-y-8">

      {tab === "perfil" && (
        <Part title="Meu perfil" id="perfil">
        <ProfileEditor />
      </Part>
      )}

      {tab === "dados" && (
        <Part title="Meus dados">
        <p>
          Baixe tudo o que o Tastory guarda sobre você, num arquivo JSON: o diário com notas e resenhas, as listas, as
          preferências do começo, quem você segue e as sugestões que você viu e o que fez com elas. A senha não vai junto.
        </p>
        <button className="btn-primary mt-2" disabled={exporting} onClick={download}>
          {exporting ? "Juntando seus dados..." : "Baixar meus dados"}
        </button>
        {exportError && <p className="text-red-700">{exportError}</p>}
      </Part>
      )}

      {tab === "dados" && (
        <Part title="Trazer do Letterboxd" id="letterboxd">
        <LetterboxdImport />
      </Part>
      )}

      {tab === "privacidade" && (
        <Part title="Quem vê meus registros" id="quem-ve">
        <VisibilityPicker />
      </Part>
      )}

      {tab === "servicos" && (
        <Part title="Meus serviços" id="servicos">
        <p>
          Marque o que você assina. No Para você, "Só nos meus serviços" e "Hoje à noite" mostram só o que dá para ver
          agora, e cada sugestão avisa se está num serviço seu.
        </p>
        <ServicesPicker />
      </Part>
      )}

      {tab === "dados" && (
        <Part title="Excluir minha conta">
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
                className="input mt-1 block w-full max-w-xs"
              />
            </label>
            <button type="submit" className="btn-primary bg-[#b42318]! text-white!" disabled={deleting || !password}>
              {deleting ? "Excluindo..." : "Excluir minha conta"}
            </button>
            {deleteError && <p className="text-red-700">{deleteError}</p>}
          </form>
        )}
      </Part>
      )}
      </div>
    </div>
  );
}
