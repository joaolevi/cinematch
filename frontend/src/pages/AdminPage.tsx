import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Poster from "../components/Poster";
import { StarsDisplay } from "../components/Stars";
import { Avatar } from "../components/WatchedBy";
import { formatDate, plural, timeAgo } from "../format";
import type { AdminReview, AdminUser, ExternalTitle, Media, MediaInput, Metrics, VariantMetrics } from "../types";
import { TAPE_COLORS, tabColor } from "../ui";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";

type Tab = "metrics" | "users" | "catalog" | "moderation";

const SOURCE_LABEL: Record<string, string> = { tmdb: "TMDB", mock: "Exemplo", manual: "Manual" };

export default function AdminPage() {
  usePageTitle("Administração");
  const [tab, setTab] = useState<Tab>("metrics");
  return (
    <div>
      <h1 className="text-3xl font-bold">Administração</h1>
      {/* As seções da administração são abas de caderno, como no resto do sistema */}
      <div role="tablist" aria-label="Seções da administração" className="mt-6 flex gap-1 border-b border-line">
        {(
          [
            ["metrics", "Painel"],
            ["users", "Usuários"],
            ["catalog", "Catálogo"],
            ["moderation", "Moderação"],
          ] as const
        ).map(([key, label], position) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className="nb-tab"
            style={tabColor(position)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6" role="tabpanel">
        {tab === "metrics" && <MetricsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "catalog" && <CatalogTab />}
        {tab === "moderation" && <ModerationTab />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Métricas
function pct(v: number) {
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const RED_INK = "text-[#b9452f]";

/** Diz a taxa em linguagem simples: "de cada 100 sugestões, 54 viraram Quero ver ou Já vi". */
function inWords(rate: number): string {
  return `De cada 100 sugestões que apareceram, ${Math.round(rate * 100)} viraram Quero ver ou Já vi.`;
}

function VariantCard({ m, label, note }: { m: VariantMetrics; label: string; note: string }) {
  const share = (n: number) => `${Math.round((n / Math.max(m.shown, 1)) * 100)}%`;
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="font-hand text-lg leading-5 text-accent">{note}</p>
      <p className="mt-3 text-4xl font-extrabold text-accent">{pct(m.acceptance_rate)}</p>
      <p className="text-sm text-stone-300">{inWords(m.acceptance_rate)}</p>
      {/* O que aconteceu com as sugestões exibidas, em uma barra só */}
      {/* A barra usa a taxa de aceitação: Quero ver e Já vi no mesmo título contam uma vez só */}
      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-bg" aria-hidden>
        <div className="bg-accent" style={{ width: pct(m.acceptance_rate) }} title={`Aceitas: ${pct(m.acceptance_rate)}`} />
        <div className="bg-[#76655b]" style={{ width: share(m.dismiss) }} title={`Não me interesso: ${m.dismiss}`} />
      </div>
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <dt className="text-muted">Pessoas</dt>
        <dd className="text-right">{m.users}</dd>
        <dt className="text-muted">Sugestões que apareceram na tela</dt>
        <dd className="text-right">{m.shown}</dd>
        <dt className="flex items-center gap-2 text-muted">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Aceitas
        </dt>
        <dd className="text-right">{pct(m.acceptance_rate)}</dd>
        <dt className="pl-[18px] text-muted">Quero ver</dt>
        <dd className="text-right">{m.want}</dd>
        <dt className="pl-[18px] text-muted">Já vi</dt>
        <dd className="text-right">{m.seen}</dd>
        <dt className="flex items-center gap-2 text-muted">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#76655b]" /> Não me interesso
        </dt>
        <dd className="text-right">{m.dismiss}</dd>
      </dl>
    </div>
  );
}

const MIN_PEOPLE_TO_CONCLUDE = 30;
const ADMIN_SYNC_PAGES = 2; // sincronização rápida; a carga completa é feita pelo script de seed

/** Diz como ler os números, de acordo com a origem deles. */
function dataWarning(m: Metrics): { title: string; text: string } {
  if (m.simulated_shown > 0) {
    const share = Math.round((m.simulated_shown / Math.max(m.overall.shown, 1)) * 100);
    return {
      title: "Estes números são de teste",
      text: `${share}% das sugestões vêm de usuários simulados. Elas mostram que a medição funciona, não qual grupo é melhor.`,
    };
  }
  if (m.real_users < MIN_PEOPLE_TO_CONCLUDE) {
    return {
      title: "Ainda são poucas pessoas",
      text: `Com ${plural(m.real_users, "pessoa", "pessoas")}, use estes números como referência, não como conclusão.`,
    };
  }
  return {
    title: "Dados de pessoas reais",
    text: "Compare os grupos com atenção à quantidade de sugestões exibidas em cada um.",
  };
}

function MetricsTab() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.adminMetrics().then(setM).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!m) return <HandNote>Somando os números...</HandNote>;
  const [a, b] = m.by_variant;
  const warning = dataWarning(m);
  const diff = Math.round((a.acceptance_rate - b.acceptance_rate) * 100);
  const comparison =
    a.shown === 0 || b.shown === 0
      ? "Ainda falta um dos grupos ver sugestões para dar para comparar."
      : diff === 0
        ? "Os dois grupos aceitaram na mesma proporção."
        : `O grupo A, com o recomendador híbrido, aceitou ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "ponto" : "pontos"} ${diff > 0 ? "a mais" : "a menos"} que o grupo B.`;
  return (
    <div>
      {/* O resumo vem primeiro, numa folha, em frases; os números detalhados ficam embaixo */}
      <section className="paper relative -rotate-[0.2deg] rounded-sm py-6 pr-6 pl-14 sm:pl-16">
        <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
        <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Em resumo:</p>
        <p className="font-display text-2xl leading-tight font-bold">{inWords(m.overall.acceptance_rate)}</p>
        <ul className="mt-2 font-hand text-xl leading-8 font-semibold opacity-85">
          <li>
            → {comparison}
            {m.trending_shown > 0 &&
              ` A comparação deixa de fora ${plural(m.trending_shown, "sugestão Em alta", "sugestões Em alta")}, que são iguais nos dois grupos.`}
          </li>
          <li>
            → {warning.title}: {warning.text}
          </li>
        </ul>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <VariantCard m={m.overall} label="Todo mundo" note="todas as sugestões, inclusive as Em alta" />
        <VariantCard m={a} label="Grupo A (híbrido)" note="só as personalizadas: gosto da pessoa + gosto parecido" />
        <VariantCard m={b} label="Grupo B (só conteúdo)" note="só as personalizadas: gosto da pessoa" />
      </div>
      <div className="mt-4 flex flex-wrap gap-6 text-sm text-muted">
        <span>Pessoas reais: {m.real_users}</span>
        <span>Registros no diário: {m.diary_entries}</span>
        <button className="cursor-pointer text-accent underline" onClick={load}>
          Atualizar
        </button>
      </div>

      <div className="mt-8 grid items-start gap-6 md:grid-cols-2">
        <section className="paper relative rounded-sm py-6 pr-6 pl-14">
          <span aria-hidden className="tape -top-2.5 left-1/2 -translate-x-1/2 rotate-2" style={{ background: TAPE_COLORS[2] }} />
          <h2 className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Como ler este painel</h2>
          <ul className="mt-1 space-y-2 text-sm leading-6">
            <li>
              <b>Taxa de aceitação:</b> das sugestões que apareceram na tela, quantas a pessoa marcou como Quero ver ou
              Já vi. Uma sugestão só conta quando pelo menos metade do card fica na tela por 1 segundo.
            </li>
            <li>
              <b>Grupo A:</b> recebe o recomendador híbrido, que junta as características dos títulos com o que
              pessoas de gosto parecido curtiram.
            </li>
            <li>
              <b>Grupo B:</b> recebe só as características dos títulos. Serve de comparação.
            </li>
            <li>
              Os grupos são comparados só pelas sugestões personalizadas. As "Em alta", de quem ainda não tem
              histórico, são iguais nos dois grupos e entram só na taxa de todo mundo.
            </li>
            <li>Cada pessoa entra em um grupo ao se cadastrar, e só este painel mostra o grupo.</li>
            <li>O que alguém registra pelo + Registrar não entra na taxa: não veio de uma sugestão.</li>
          </ul>
        </section>
        <section
          className="postit rotate-1 px-6 py-5"
          style={{ "--note": "#b9d0e4" } as CSSProperties}
        >
          <h2 className="font-hand text-2xl leading-8 font-bold">Como o recomendador está agora</h2>
          <ul className="mt-1 space-y-2 text-sm leading-6">
            <li>
              <b>Catálogo:</b> {m.catalog_size} títulos ({m.movies} filmes e {m.series} séries).
            </li>
            <li>
              <b>MovieLens:</b> {m.external_neighbors_enabled ? "ligado" : "desligado"}, com {m.titles_with_neighbors}{" "}
              filmes que têm vizinhos de gosto vindos de avaliações reais.
            </li>
            <li>
              <b>Séries:</b> seguem só pelas características, porque ainda não têm avaliações reais.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Usuários
const ACTIVE_DAYS = 7;
const NOTE_COLORS = ["#f6d27a", "#f3a48f", "#b7d1b9", "#f2b8c8", "#b9d0e4", "#d4c3ea", "#f6d27a", "#f3a48f"];

/** Pessoas cadastradas, o que cada uma fez e a opção de apagar a conta. */
function UsersTab() {
  const [kind, setKind] = useState<"real" | "simulated" | "all">("real");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: AdminUser[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reload, setReload] = useState(0);
  const load = () => setReload((n) => n + 1);

  useEffect(() => {
    let current = true; // a resposta de um filtro antigo não sobrescreve o filtro atual
    const timer = setTimeout(() => {
      api
        .adminUsers({ q: q.trim() || undefined, kind, limit: 500 })
        .then((d) => current && setData(d))
        .catch((e) => current && setError(e.message));
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, kind, reload]);

  const notes = useMemo(() => {
    const items = data?.items ?? [];
    const since = Date.now() - ACTIVE_DAYS * 86_400_000;
    const active = items.filter((u) => new Date(u.last_active.endsWith("Z") ? u.last_active : `${u.last_active}Z`).getTime() >= since);
    const when = (iso: string) => new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
    const shown = items.reduce((sum, u) => sum + u.shown, 0);
    const accepted = items.reduce((sum, u) => sum + u.accepted, 0);
    const groupA = items.filter((u) => u.ab_group === "A").length;
    return [
      { value: String(data?.total ?? 0), label: kind === "simulated" ? "pessoas simuladas" : "pessoas" },
      { value: String(items.filter((u) => when(u.created_at) >= since).length), label: `chegaram nos últimos ${ACTIVE_DAYS} dias` },
      { value: String(active.length), label: `usaram nos últimos ${ACTIVE_DAYS} dias` },
      { value: String(items.filter((u) => u.onboarded).length), label: "terminaram o questionário" },
      { value: String(items.reduce((sum, u) => sum + u.diary_entries, 0)), label: "registros no diário" },
      { value: String(items.reduce((sum, u) => sum + u.reviews, 0)), label: "resenhas escritas" },
      { value: shown ? `${Math.round((accepted / shown) * 100)}%` : "–", label: "das sugestões vistas foram aceitas" },
      { value: `${groupA} · ${items.length - groupA}`, label: "no grupo A · no grupo B" },
    ].map((note, i) => ({ ...note, color: NOTE_COLORS[i % NOTE_COLORS.length] }));
  }, [data, kind]);

  async function remove(user: AdminUser) {
    if (!confirm(`Apagar a conta de ${user.name}? O diário, as listas e as resenhas saem junto, e não dá para desfazer.`)) return;
    await api.adminDeleteUser(user.id);
    load();
  }

  if (error) return <p className="text-red-300">{error}</p>;
  return (
    <div>
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-4 xl:grid-cols-8">
        {notes.map((note, i) => (
          <li
            key={note.label}
            className="postit flex aspect-[4/3] flex-col justify-center px-3 text-center"
            style={{ "--note": note.color, rotate: `${[-2, 1.5, -1, 2, -1.5, 1, -2, 1.5][i]}deg` } as CSSProperties}
          >
            <span className="font-hand text-4xl leading-none font-bold">{note.value}</span>
            <span className="mt-1 font-hand text-lg leading-5 font-semibold">{note.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          className="input search-input max-w-sm"
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(
          [
            ["real", "Pessoas reais"],
            ["simulated", "Simuladas"],
            ["all", "Todas"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setKind(key)}
            className={`chip cursor-pointer px-4 py-1.5 text-sm ${kind === key ? "border-accent text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        As simuladas foram criadas para testar o recomendador e não são pessoas de verdade. Aceitação: das sugestões que a
        pessoa viu, quantas viraram Quero ver ou Já vi.
      </p>

      {!data ? (
        <HandNote className="mt-6">Chamando todo mundo...</HandNote>
      ) : data.items.length === 0 ? (
        <HandNote className="mt-6">Ninguém com esse nome por aqui.</HandNote>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs tracking-wider text-muted uppercase">
              <tr className="border-b border-line">
                <th className="py-2 pr-4 font-semibold">Pessoa</th>
                <th className="py-2 pr-4 font-semibold">Grupo</th>
                <th className="py-2 pr-4 font-semibold">Entrou em</th>
                <th className="py-2 pr-4 text-right font-semibold">Diário</th>
                <th className="py-2 pr-4 text-right font-semibold">Resenhas</th>
                <th className="py-2 pr-4 font-semibold">Aceitação</th>
                <th className="py-2 pr-4 font-semibold">Última atividade</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-b border-line/60">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="h-8 w-8" />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {u.name}
                          {u.role === "admin" && <span className="ml-2 chip px-2 py-0 text-[11px] text-accent">admin</span>}
                          {!u.onboarded && u.role !== "admin" && <span className="ml-2 text-xs text-muted">sem questionário</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-stone-300">{u.ab_group === "A" ? "A · híbrido" : "B · só conteúdo"}</td>
                  <td className="py-3 pr-4 text-stone-300">{formatDate(u.created_at.slice(0, 10))}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{u.diary_entries}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{u.reviews}</td>
                  <td className="py-3 pr-4 text-stone-300">
                    {u.shown ? `${Math.round((u.accepted / u.shown) * 100)}% (${u.accepted} de ${u.shown})` : "ainda não viu sugestões"}
                  </td>
                  <td className="py-3 pr-4 text-stone-300">{timeAgo(u.last_active)}</td>
                  <td className="py-3 text-right">
                    {u.role !== "admin" && (
                      <button className="btn-danger px-3 py-1 text-xs whitespace-nowrap" onClick={() => remove(u)}>
                        Apagar conta
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Catálogo
const EMPTY: MediaInput = { type: "movie", title: "", year: null, overview: "", genres: [], tags: [], creators: [], popularity: 50 };

function MediaForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: MediaInput;
  onCancel: () => void;
  onSave: (data: MediaInput) => Promise<void>;
}) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const csv = (v: string[]) => v.join(", ");
  const parse = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave(f);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="card grid gap-3 p-5 md:grid-cols-2">
      <input className="input" placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
      <div className="flex gap-2">
        <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MediaInput["type"] })}>
          <option value="movie">Filme</option>
          <option value="series">Série</option>
        </select>
        <input
          className="input"
          type="number"
          placeholder="Ano"
          value={f.year ?? ""}
          onChange={(e) => setF({ ...f, year: e.target.value ? Number(e.target.value) : null })}
        />
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          title="Popularidade, de 0 a 100"
          value={f.popularity}
          onChange={(e) => setF({ ...f, popularity: Number(e.target.value) })}
        />
      </div>
      <input className="input" placeholder="Gêneros (separados por vírgula)" defaultValue={csv(f.genres)} onChange={(e) => setF({ ...f, genres: parse(e.target.value) })} />
      <input className="input" placeholder="Palavras-chave (separadas por vírgula)" defaultValue={csv(f.tags)} onChange={(e) => setF({ ...f, tags: parse(e.target.value) })} />
      <input className="input" placeholder="Direção ou criação (separadas por vírgula)" defaultValue={csv(f.creators)} onChange={(e) => setF({ ...f, creators: parse(e.target.value) })} />
      <input className="input" placeholder="Sinopse" value={f.overview} onChange={(e) => setF({ ...f, overview: e.target.value })} />
      {err && <p className="text-sm text-red-300 md:col-span-2">{err}</p>}
      <div className="flex gap-2 md:col-span-2">
        <button className="btn-primary">Salvar</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CatalogTab() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Media | "new" | null>(null);

  const load = () =>
    api.search({ q, limit: 100 }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <TmdbPanel onChange={load} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input className="input max-w-sm" placeholder="Filtrar catálogo" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-muted">{total} títulos</span>
        <button className="btn-ghost ml-auto" onClick={() => setEditing("new")}>
          + Novo título
        </button>
      </div>

      {editing && (
        <div className="mt-4">
          <MediaForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? EMPTY : editing}
            onCancel={() => setEditing(null)}
            onSave={async (data) => {
              if (editing === "new") await api.adminCreateMedia(data);
              else await api.adminUpdateMedia(editing.id, data);
              setEditing(null);
              load();
            }}
          />
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted uppercase">
            <tr>
              <th className="py-2 pr-4">Título</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Ano</th>
              <th className="py-2 pr-4">Gêneros</th>
              <th className="py-2 pr-4">Origem</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t border-line/50">
                <td className="py-2 pr-4">
                  <Link to={`/media/${m.id}`} className="font-medium hover:text-accent">
                    {m.title}
                  </Link>
                </td>
                <td className="py-2 pr-4">{m.type === "movie" ? "Filme" : "Série"}</td>
                <td className="py-2 pr-4">{m.year}</td>
                <td className="py-2 pr-4 text-muted">{m.genres.join(", ")}</td>
                <td className="py-2 pr-4 text-muted">{SOURCE_LABEL[m.source] ?? m.source}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button className="btn-ghost mr-2 px-2 py-1 text-xs" onClick={() => setEditing(m)}>
                    Editar
                  </button>
                  <button
                    className="btn-danger px-2 py-1 text-xs"
                    onClick={async () => {
                      if (confirm(`Excluir "${m.title}" do catálogo?`)) {
                        await api.adminDeleteMedia(m.id);
                        load();
                      }
                    }}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ TMDB
function TmdbPanel({ onChange }: { onChange: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ExternalTitle[] | null>(null);

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(label);
    setErr(null);
    try {
      return await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sync(provider: "tmdb" | "mock") {
    const r = await run(provider, () => api.adminSync(provider, ADMIN_SYNC_PAGES));
    if (r) {
      setMsg(
        `${provider === "tmdb" ? "TMDB" : "Catálogo de exemplo"}: ${plural(r.fetched, "título recebido", "títulos recebidos")}, ${plural(r.created, "novo", "novos")}, ${plural(r.merged, "unificado", "unificados")} com o catálogo e ${plural(r.updated, "atualizado", "atualizados")}.`,
      );
      onChange();
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const r = await run("search", () => api.tmdbSearch(q.trim()));
    if (r) setResults(r);
  }

  async function importTitle(t: ExternalTitle) {
    const [tmdbType, id] = t.external_id.split("-");
    const r = await run(t.external_id, () => api.tmdbImport(tmdbType === "tv" ? "series" : "movie", Number(id)));
    if (r) {
      setResults((rs) => rs?.map((x) => (x.external_id === t.external_id ? { ...x, media_id: r.media.id } : x)) ?? null);
      setMsg(`"${r.media.title}" importado do TMDB`);
      onChange();
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Sincronizar catálogo externo</p>
          <p className="text-sm text-muted">
            Importa filmes e séries populares no Brasil direto do TMDB (com pôster, sinopse e diretor).
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={!!busy} onClick={() => sync("tmdb")}>
            {busy === "tmdb" ? "Buscando no TMDB..." : "⟳ Sincronizar com TMDB"}
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => sync("mock")} title="Carrega títulos de exemplo, sem precisar de internet">
            Usar catálogo de exemplo
          </button>
        </div>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <input className="input" placeholder="Buscar um título no TMDB para importar (ex.: Cidade de Deus)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost" disabled={!!busy}>
          {busy === "search" ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {msg && <p className="text-sm text-accent">{msg}</p>}
      {err && <p className="text-sm text-red-300">{err}</p>}

      {results && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {results.length === 0 && <HandNote>Nada com esse nome no TMDB.</HandNote>}
          {results.map((t) => (
            <div key={t.external_id} className="flex flex-col">
              <Poster media={{ ...t, id: 0, source: "tmdb", tags: [], creators: [] }} />
              <p className="mt-2 line-clamp-1 text-sm font-semibold">{t.title}</p>
              <p className="text-xs text-muted">
                {t.type === "movie" ? "Filme" : "Série"} · {t.year ?? "?"}
              </p>
              {t.media_id ? (
                <Link to={`/media/${t.media_id}`} className="btn-ghost mt-2 px-2 py-1 text-xs">
                  ✓ No catálogo
                </Link>
              ) : (
                <button className="btn-primary mt-2 px-2 py-1 text-xs" disabled={!!busy} onClick={() => importTitle(t)}>
                  {busy === t.external_id ? "Importando..." : "+ Importar"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Moderação
function ModerationTab() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const load = () => api.adminReviews().then(setReviews);
  useEffect(() => {
    load();
  }, []);

  const shown = reviews.filter((r) => (filter === "all" ? true : filter === "hidden" ? r.review_hidden : !r.review_hidden));

  return (
    <div>
      <div className="flex gap-2">
        {(["all", "visible", "hidden"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip cursor-pointer ${filter === f ? "border-accent text-accent" : ""}`}>
            {f === "all" ? "Todas" : f === "visible" ? "Visíveis" : "Ocultas"}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {shown.length === 0 && <HandNote>Nenhuma resenha por aqui.</HandNote>}
        {shown.map((r) => (
          <div key={r.id} className={`card flex flex-wrap items-center gap-4 p-4 ${r.review_hidden ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{r.user_name}</span>{" "}
                <span className="text-muted">sobre</span>{" "}
                <Link to={`/media/${r.media_id}`} className="font-semibold text-accent">
                  {r.media_title}
                </Link>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <StarsDisplay value={r.rating} size={13} />
                <span className="text-xs text-muted">{r.user_email}</span>
              </div>
              <p className="ruled mt-2 font-hand text-xl text-stone-200">{r.review}</p>
            </div>
            <button
              className={r.review_hidden ? "btn-ghost" : "btn-danger"}
              onClick={async () => {
                await api.adminModerate(r.id, !r.review_hidden);
                load();
              }}
            >
              {r.review_hidden ? "Restaurar" : "Ocultar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
