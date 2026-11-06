import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Poster from "../components/Poster";
import { StarsDisplay } from "../components/Stars";
import type { AdminReview, ExternalTitle, Media, MediaInput, Metrics, VariantMetrics } from "../types";

type Tab = "metrics" | "catalog" | "moderation";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("metrics");
  return (
    <div>
      <h1 className="text-3xl font-bold">Administração</h1>
      <div className="mt-4 flex gap-2">
        {(
          [
            ["metrics", "Métricas A/B"],
            ["catalog", "Catálogo"],
            ["moderation", "Moderação"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`chip cursor-pointer px-4 py-1.5 text-sm ${tab === key ? "border-accent text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "metrics" && <MetricsTab />}
        {tab === "catalog" && <CatalogTab />}
        {tab === "moderation" && <ModerationTab />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Métricas
function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function VariantCard({ m, label }: { m: VariantMetrics; label: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-accent">{pct(m.acceptance_rate)}</p>
      <p className="text-xs text-muted">taxa de aceitação</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full bg-accent" style={{ width: pct(m.acceptance_rate) }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">Usuários</dt>
        <dd className="text-right">{m.users}</dd>
        <dt className="text-muted">Sugestões exibidas</dt>
        <dd className="text-right">{m.shown}</dd>
        <dt className="text-muted">Quero ver</dt>
        <dd className="text-right">{m.want}</dd>
        <dt className="text-muted">Já vi</dt>
        <dd className="text-right">{m.seen}</dd>
        <dt className="text-muted">Não me interesso</dt>
        <dd className="text-right">{m.dismiss}</dd>
      </dl>
    </div>
  );
}

function MetricsTab() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.adminMetrics().then(setM).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!m) return <p className="text-muted">Carregando...</p>;
  const [a, b] = m.by_variant;
  return (
    <div>
      <p className="max-w-3xl text-sm text-muted">
        Taxa de aceitação = (Quero ver + Já vi) ÷ sugestões exibidas. O grupo <b>A</b> recebe o recomendador{" "}
        <b>híbrido</b> (conteúdo + colaborativo); o grupo <b>B</b>, apenas o <b>baseado em conteúdo</b>. Os
        usuários sintéticos do seed simulam beta testers.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <VariantCard m={m.overall} label="Total" />
        <VariantCard m={a} label="Grupo A · híbrido" />
        <VariantCard m={b} label="Grupo B · só conteúdo" />
      </div>
      <div className="mt-4 flex flex-wrap gap-6 text-sm text-muted">
        <span>Catálogo: {m.catalog_size} títulos</span>
        <span>Usuários: {m.users}</span>
        <span>Registros no diário: {m.diary_entries}</span>
        <button className="text-accent underline" onClick={load}>
          atualizar
        </button>
      </div>
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
          title="Popularidade (0–100)"
          value={f.popularity}
          onChange={(e) => setF({ ...f, popularity: Number(e.target.value) })}
        />
      </div>
      <input className="input" placeholder="Gêneros (separados por vírgula)" defaultValue={csv(f.genres)} onChange={(e) => setF({ ...f, genres: parse(e.target.value) })} />
      <input className="input" placeholder="Tags (separadas por vírgula)" defaultValue={csv(f.tags)} onChange={(e) => setF({ ...f, tags: parse(e.target.value) })} />
      <input className="input" placeholder="Diretores/criadores" defaultValue={csv(f.creators)} onChange={(e) => setF({ ...f, creators: parse(e.target.value) })} />
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
                <td className="py-2 pr-4 text-muted">{m.source}</td>
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
    const r = await run(provider, () => api.adminSync(provider));
    if (r) {
      setMsg(
        `${r.provider}: ${r.fetched} recebidos · ${r.created} novos · ${r.merged} unificados com o catálogo · ${r.updated} atualizados`,
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
          <button className="btn-ghost" disabled={!!busy} onClick={() => sync("mock")} title="Funciona offline">
            Mock
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
          {results.length === 0 && <p className="text-sm text-muted">Nada encontrado.</p>}
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
        {shown.length === 0 && <p className="text-sm text-muted">Nenhuma avaliação.</p>}
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
              <p className="mt-2 text-slate-300">{r.review}</p>
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
