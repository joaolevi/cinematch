import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { formatDate, formatMinutes, plural } from "../format";
import { episodePath } from "../pages/EpisodePage";
import type { Episode, PartMark, Season } from "../types";
import HandNote from "./HandNote";
import { SeenToggle } from "./PartMarker";
import { StarsInput } from "./Stars";

/** Um episódio na lista: visto, o nome (que abre a página do episódio) e as estrelas. A anotação fica na página dele. */
function EpisodeRow({
  mediaId,
  season,
  episode,
  onSaved,
}: {
  mediaId: number;
  season: number;
  episode: Episode;
  onSaved: (e: Episode) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(data: Partial<PartMark>) {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.rateEpisode(mediaId, season, episode.number, data);
      onSaved({ ...episode, ...saved });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const name = episode.name ?? `Episódio ${episode.number}`;
  const meta = [episode.air_date && formatDate(episode.air_date), episode.runtime && formatMinutes(episode.runtime)].filter(Boolean);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SeenToggle
          seen={episode.seen}
          album={false}
          label={`o episódio ${episode.number}`}
          busy={busy}
          onToggle={() => save(episode.seen ? { seen: false } : { seen: true })}
        />
        <div className="min-w-0 flex-1 basis-48">
          <Link to={episodePath(mediaId, season, episode.number)} className="font-semibold hover:text-accent hover:underline">
            <span className="mr-2 text-muted">E{episode.number}</span>
            {name}
          </Link>
          {(meta.length > 0 || episode.note) && (
            <p className="text-xs text-muted">
              {meta.join(" · ")}
              {episode.note && <>{meta.length > 0 && " · "}com anotação</>}
            </p>
          )}
        </div>
        <div aria-label={`Nota do episódio ${episode.number}`} className={busy ? "opacity-60" : ""}>
          <StarsInput value={episode.rating} onChange={(v) => save({ seen: true, rating: v, note: episode.note })} size={20} bare />
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-300">{error}</p>}
    </li>
  );
}

/** Uma temporada, que abre a lista de episódios. */
function SeasonBlock({
  mediaId,
  season,
  marked,
  onChange,
}: {
  mediaId: number;
  season: Season;
  marked: number;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && episodes === null) {
      try {
        setEpisodes(await api.episodes(mediaId, season.number));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }

  const total = season.episodes ?? episodes?.length ?? null;
  const done = episodes ? episodes.filter((e) => e.seen).length : marked;
  const rated = episodes?.filter((e) => e.rating != null) ?? [];
  const average = rated.length ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length : null;
  return (
    <li className="card overflow-hidden">
      <button
        className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-surface-2"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="font-display text-lg font-bold">
          Temporada {season.number}
          {season.year && <span className="ml-2 text-sm font-normal text-muted">{season.year}</span>}
        </span>
        <span className="text-sm text-muted">
          {total ? `${done} de ${plural(total, "episódio visto", "episódios vistos")}` : plural(done, "episódio visto", "episódios vistos")}
          {average != null && ` · sua média ${average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`}
          <span aria-hidden className="ml-2">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-4">
          {error && <p className="py-3 text-sm text-red-300">{error}</p>}
          {!episodes && !error && <p className="py-3 text-sm text-muted">Abrindo os episódios...</p>}
          {episodes?.length === 0 && <HandNote className="py-3">Ainda não temos a lista desta temporada.</HandNote>}
          {episodes && episodes.length > 0 && episodes.some((e) => !e.seen) && (
            <div className="pt-3">
              <button
                className="btn-ghost px-3 py-1 text-sm"
                disabled={marking}
                onClick={async () => {
                  setMarking(true);
                  try {
                    setEpisodes(await api.markSeason(mediaId, season.number));
                    onChange();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setMarking(false);
                  }
                }}
              >
                {marking ? "Marcando..." : "Marcar a temporada inteira como vista"}
              </button>
            </div>
          )}
          {episodes && (
            <ul className="divide-y divide-line/60">
              {episodes.map((e) => (
                <EpisodeRow
                  key={e.number}
                  mediaId={mediaId}
                  season={season.number}
                  episode={e}
                  onSaved={(saved) => {
                    setEpisodes(episodes.map((x) => (x.number === saved.number ? saved : x)));
                    onChange();
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Episódios da série (RFF24): cada temporada abre a lista; cada episódio tem visto e estrelas, e o nome abre a página
 * dele, com a sinopse e a anotação. A nota da série inteira continua no "Terminei"; o primeiro episódio marcado põe a
 * série como assistindo.
 */
export default function Episodes({
  mediaId,
  seasons,
  counts,
  onChange,
}: {
  mediaId: number;
  seasons: Season[];
  counts: Record<string, number>;
  onChange: () => void;
}) {
  if (seasons.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-bold">Episódios</h2>
      <p className="mt-1 text-sm text-muted">
        Marque o que já viu e dê nota a cada episódio. Clique no nome para ver a sinopse e anotar; a nota da série inteira
        fica no “Terminei”.
      </p>
      <ul className="mt-4 space-y-3">
        {seasons.map((s) => (
          <SeasonBlock key={s.number} mediaId={mediaId} season={s} marked={counts[String(s.number)] ?? 0} onChange={onChange} />
        ))}
      </ul>
    </section>
  );
}
