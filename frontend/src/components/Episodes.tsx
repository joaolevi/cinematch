import { useState } from "react";
import { api } from "../api";
import { formatDate, plural } from "../format";
import type { Episode, Season } from "../types";
import HandNote from "./HandNote";
import { StarsInput } from "./Stars";

/** Um episódio: o nome, as estrelas e a anotação, que só a própria pessoa vê. */
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
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState(episode.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(rating: number | null, text: string | null) {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.rateEpisode(mediaId, season, episode.number, { rating, note: text });
      onSaved({ ...episode, rating: saved.rating, note: saved.note });
      setWriting(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const marked = episode.rating != null || !!episode.note;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="font-semibold">
            <span className={`mr-2 font-hand text-lg ${marked ? "text-accent" : "text-muted"}`}>
              {marked ? "✓" : ""} E{episode.number}
            </span>
            {episode.name ?? `Episódio ${episode.number}`}
          </p>
          {episode.air_date && <p className="text-xs text-muted">{formatDate(episode.air_date)}</p>}
        </div>
        <div aria-label={`Nota do episódio ${episode.number}`} className={busy ? "opacity-60" : ""}>
          <StarsInput value={episode.rating} onChange={(v) => save(v, episode.note)} size={20} bare />
        </div>
        <button className="text-xs font-semibold text-muted underline hover:text-accent" onClick={() => setWriting(!writing)}>
          {episode.note ? "Editar a anotação" : "Anotar"}
        </button>
        {marked && (
          <button className="text-xs text-muted underline hover:text-accent" disabled={busy} onClick={() => save(null, null)}>
            Desmarcar
          </button>
        )}
      </div>
      {episode.note && !writing && <p className="mt-1 text-sm whitespace-pre-line text-stone-300">“{episode.note}”</p>}
      {writing && (
        <form
          className="mt-2 flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(episode.rating, note);
          }}
        >
          <label className="sr-only" htmlFor={`nota-${season}-${episode.number}`}>
            Anotação do episódio {episode.number}
          </label>
          <textarea
            id={`nota-${season}-${episode.number}`}
            value={note}
            maxLength={1000}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que você achou deste episódio? Só você vê."
            className="input min-w-0 flex-1 resize-y py-1.5 text-sm"
          />
          <button className="btn-primary px-3 py-1.5 text-sm" disabled={busy}>
            Salvar a anotação
          </button>
        </form>
      )}
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
  const done = episodes ? episodes.filter((e) => e.rating != null || e.note).length : marked;
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
          {total ? `${done} de ${plural(total, "episódio", "episódios")}` : plural(done, "episódio marcado", "episódios marcados")}
          {average != null && ` · sua média ${average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`}
          <span aria-hidden className="ml-2">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-4">
          {error && <p className="py-3 text-sm text-red-300">{error}</p>}
          {!episodes && !error && <p className="py-3 text-sm text-muted">Abrindo os episódios...</p>}
          {episodes?.length === 0 && <HandNote className="py-3">Ainda não temos a lista desta temporada.</HandNote>}
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
 * Episódios da série (RFF24): cada temporada abre a lista, e cada episódio tem estrelas e uma anotação que só a pessoa
 * vê. A nota da série inteira continua no "Terminei"; o primeiro episódio marcado põe a série como assistindo.
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
        Dê nota a cada episódio e anote o que achou. As anotações são só suas; a nota da série inteira fica no “Terminei”.
      </p>
      <ul className="mt-4 space-y-3">
        {seasons.map((s) => (
          <SeasonBlock key={s.number} mediaId={mediaId} season={s} marked={counts[String(s.number)] ?? 0} onChange={onChange} />
        ))}
      </ul>
    </section>
  );
}
