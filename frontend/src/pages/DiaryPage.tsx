import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import MediaCard from "../components/MediaCard";
import Poster from "../components/Poster";
import SeenModal from "../components/SeenModal";
import { StarsDisplay } from "../components/Stars";
import { formatDate, formatRating } from "../format";
import type { DiaryEntry } from "../types";

const RANKING_SIZE = 10;
const LOVED_FROM = 3.5;
const HATED_BELOW = 3; // quem só dá notas altas não vê títulos bons na lista dos que odiou

function Ranking({ title, entries, color }: { title: string; entries: DiaryEntry[]; color: string }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className={`text-lg font-bold ${color}`}>{title}</h2>
      <ol className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {entries.map((e, position) => (
          <li key={e.id} className="w-24 shrink-0">
            <Link to={`/media/${e.media.id}`} className="relative block" title={e.media.title}>
              <Poster media={e.media} compact />
              <span className={`absolute top-1 left-1 rounded-md bg-bg/85 px-1.5 text-sm font-extrabold ${color}`}>
                {position + 1}
              </span>
            </Link>
            <div className="mt-1.5">
              <StarsDisplay value={e.rating} size={13} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function monthLabel(entry: DiaryEntry): string {
  if (!entry.consumed_at) return entry.from_onboarding ? "Seus primeiros favoritos" : "Sem data";
  const d = new Date(entry.consumed_at + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** "A história do seu gosto": linha do tempo do que o usuário consumiu. */
export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .diary()
      .then(setEntries)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    for (const e of entries ?? []) {
      const k = monthLabel(e);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries]);

  const stats = useMemo(() => {
    const rated = (entries ?? []).filter((e) => e.rating != null);
    const avg = rated.length ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : null;
    const genreCount = new Map<string, number>();
    for (const e of entries ?? []) for (const g of e.media.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    const top = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
    return { total: entries?.length ?? 0, avg, top };
  }, [entries]);

  const rankings = useMemo(() => {
    const rated = (entries ?? []).filter((e) => e.rating != null);
    const note = (e: DiaryEntry) => e.rating ?? 0;
    return {
      loved: rated.filter((e) => note(e) >= LOVED_FROM).sort((a, b) => note(b) - note(a)).slice(0, RANKING_SIZE),
      hated: rated.filter((e) => note(e) < HATED_BELOW).sort((a, b) => note(a) - note(b)).slice(0, RANKING_SIZE),
    };
  }, [entries]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Meu diário</h1>
      <p className="mt-1 text-muted">A história do seu gosto.</p>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <div className="card p-4">
          <p className="text-2xl font-bold text-accent">{stats.total}</p>
          <p className="text-xs text-muted">{stats.total === 1 ? "título registrado" : "títulos registrados"}</p>
        </div>
        <div className="card p-4">
          <p className={`font-bold text-amber ${stats.avg != null ? "text-2xl" : "text-sm leading-8"}`}>
            {stats.avg != null ? formatRating(stats.avg) : "Sem notas"}
          </p>
          <p className="text-xs text-muted">nota média</p>
        </div>
        <div className="card p-4">
          <p className="line-clamp-2 text-sm font-bold text-violet">{stats.top.join(", ") || "Nenhum ainda"}</p>
          <p className="text-xs text-muted">gêneros mais vistos</p>
        </div>
      </div>

      <Ranking title="Top 10 que você mais amou" entries={rankings.loved} color="text-amber" />
      <Ranking title="Top 10 que você mais odiou" entries={rankings.hated} color="text-coral" />

      {error && <p className="mt-6 text-red-300">{error}</p>}
      {entries?.length === 0 && (
        <p className="mt-8 text-muted">
          Sua história começa aqui! Marque "Já vi" no <Link to="/" className="text-accent underline">feed</Link> ou na{" "}
          <Link to="/buscar" className="text-accent underline">busca</Link>.
        </p>
      )}

      <div className="mt-8 space-y-10">
        {groups.map(([label, list]) => (
          <section key={label}>
            <h2 className="text-sm font-semibold tracking-wider text-accent uppercase">{label}</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
              {list.map((e) => (
                <MediaCard key={e.id} media={e.media}>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <StarsDisplay value={e.rating} size={13} />
                    {e.consumed_at && <span className="text-xs text-muted">{formatDate(e.consumed_at)}</span>}
                  </div>
                  {e.review && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-300" title={e.review}>
                      {e.review_hidden && <span className="mr-1 text-red-300">[oculta pela moderação]</span>}
                      {e.review}
                    </p>
                  )}
                  <div className="mt-auto grid grid-cols-2 gap-1 pt-2">
                    <button className="btn-ghost px-1 py-1 text-[11px]" onClick={() => setEditing(e)}>
                      Editar
                    </button>
                    <button
                      className="btn-danger px-1 py-1 text-[11px]"
                      onClick={async () => {
                        if (confirm(`Remover "${e.media.title}" do diário?`)) {
                          await api.deleteDiary(e.id);
                          load();
                        }
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </MediaCard>
              ))}
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <SeenModal
          media={editing.media}
          initialRating={editing.rating}
          initialReview={editing.review ?? ""}
          initialDate={editing.consumed_at}
          onClose={() => setEditing(null)}
          onConfirm={async (rating, review, date) => {
            await api.updateDiary(editing.id, { rating, review, consumed_at: date });
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
