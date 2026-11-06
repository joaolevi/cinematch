import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import Poster from "../components/Poster";
import SeenModal from "../components/SeenModal";
import { StarsDisplay } from "../components/Stars";
import type { MediaDetail, UserList } from "../types";

export default function MediaPage() {
  const { id } = useParams();
  const mediaId = Number(id);
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const [lists, setLists] = useState<UserList[]>([]);
  const [showSeen, setShowSeen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([api.media(mediaId), api.lists()]);
      setMedia(m);
      setLists(l);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mediaId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!media) return <p className="text-muted">Carregando...</p>;

  const watchlist = lists.find((l) => l.is_watchlist);
  const customLists = lists.filter((l) => !l.is_watchlist);
  const status = media.my_status;

  async function toggleList(list: UserList, inList: boolean) {
    if (inList) await api.removeFromList(list.id, mediaId);
    else await api.addToList(list.id, mediaId);
    load();
  }

  return (
    <div>
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <div className="mx-auto w-48 md:w-full">
          <Poster media={media} />
        </div>
        <div>
          <p className="text-sm text-muted">
            {media.type === "movie" ? "Filme" : "Série"} · {media.year} · {media.creators.join(", ")}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold">{media.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {media.genres.map((g) => (
              <span key={g} className="chip border-accent/40 text-accent">
                {g}
              </span>
            ))}
            {media.tags.map((t) => (
              <span key={t} className="chip">
                #{t}
              </span>
            ))}
          </div>
          <p className="mt-5 max-w-2xl leading-relaxed text-slate-300">{media.overview}</p>

          <div className="mt-5 flex items-center gap-3 text-sm">
            <StarsDisplay value={media.avg_rating} />
            <span className="text-muted">
              {media.avg_rating != null ? `${media.avg_rating.toFixed(1)} · ` : ""}
              {media.ratings_count} nota(s) na plataforma
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setShowSeen(true)}>
              {status.diary_entry_id ? "✓ No diário — editar" : "✓ Já vi"}
            </button>
            {watchlist && (
              <button className="btn-ghost" onClick={() => toggleList(watchlist, status.in_watchlist)}>
                {status.in_watchlist ? "− Remover do Quero ver" : "+ Quero ver"}
              </button>
            )}
          </div>
          {status.rating != null && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              Sua nota: <StarsDisplay value={status.rating} />
            </p>
          )}

          {customLists.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold">Suas listas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {customLists.map((l) => {
                  const inList = status.list_ids.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      className={`chip cursor-pointer ${inList ? "border-accent text-accent" : ""}`}
                      onClick={() => toggleList(l, inList)}
                    >
                      {inList ? "✓ " : "+ "}
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Resenhas</h2>
        {media.reviews.length === 0 && <p className="mt-2 text-sm text-muted">Ninguém comentou ainda. Que tal ser a primeira pessoa?</p>}
        <div className="mt-4 space-y-3">
          {media.reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold">{r.user_name}</span>
                <StarsDisplay value={r.rating} size={14} />
              </div>
              <p className="mt-2 text-slate-300">{r.review}</p>
            </div>
          ))}
        </div>
      </section>

      {showSeen && (
        <SeenModal
          media={media}
          initialRating={status.rating}
          onClose={() => setShowSeen(false)}
          onConfirm={async (rating, review, date) => {
            if (status.diary_entry_id) {
              await api.updateDiary(status.diary_entry_id, {
                rating,
                consumed_at: date,
                ...(review ? { review } : {}),
              });
            } else {
              await api.addDiary(mediaId, rating, review, date);
            }
            setShowSeen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
