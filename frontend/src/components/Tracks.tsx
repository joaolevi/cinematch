import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { formatSeconds, plural } from "../format";
import { trackPath } from "../pages/TrackPage";
import type { Media, PartMark, Track } from "../types";
import HandNote from "./HandNote";
import { SeenToggle } from "./PartMarker";
import { StarsInput } from "./Stars";

/** Uma faixa: ouvi, o número, o título (que abre a página da faixa), quem canta quando não é o artista do disco, a
 * duração e as estrelas. */
function TrackRow({ album, track, onSaved }: { album: Media; track: Track; onSaved: (t: Track) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(data: Partial<PartMark>) {
    setBusy(true);
    setError(null);
    try {
      onSaved({ ...track, ...(await api.rateTrack(album.id, track.disc, track.number, data)) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const guests = track.artists.filter((a) => !album.creators.includes(a));
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SeenToggle
          seen={track.seen}
          album
          label={track.title}
          busy={busy}
          size="h-8 w-8"
          onToggle={() => save(track.seen ? { seen: false } : { seen: true })}
        />
        <span className="w-6 text-right text-sm text-muted tabular-nums">{track.number}</span>
        <div className="min-w-0 flex-1 basis-40">
          <Link to={trackPath(album.id, track.disc, track.number)} className="font-semibold hover:text-accent hover:underline">
            {track.title}
          </Link>
          {(guests.length > 0 || track.note) && (
            <p className="text-xs text-muted">
              {guests.join(", ")}
              {track.note && <>{guests.length > 0 && " · "}com anotação</>}
            </p>
          )}
        </div>
        {track.length_sec != null && <span className="text-sm text-muted tabular-nums">{formatSeconds(track.length_sec)}</span>}
        <div aria-label={`Nota de ${track.title}`} className={busy ? "opacity-60" : ""}>
          <StarsInput value={track.rating} onChange={(v) => save({ seen: true, rating: v, note: track.note })} size={18} bare />
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-300">{error}</p>}
    </li>
  );
}

/** As faixas do álbum, do MusicBrainz: cada uma com ouvi e estrelas, e o título abre a página dela. */
export default function Tracks({ album }: { album: Media }) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTracks(null);
    api.tracks(album.id).then(setTracks).catch((e) => setError((e as Error).message));
  }, [album.id]);

  const discs = [...new Set((tracks ?? []).map((t) => t.disc))];
  const heard = tracks?.filter((t) => t.seen).length ?? 0;
  return (
    <section className="mt-12" aria-labelledby="faixas-titulo">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="faixas-titulo" className="font-display text-xl font-bold">
          Faixas
        </h2>
        {tracks && tracks.length > 0 && (
          <p className="text-sm text-muted">
            {heard} de {plural(tracks.length, "faixa ouvida", "faixas ouvidas")}
          </p>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {!tracks && !error && <p className="mt-2 text-sm text-muted">Buscando as faixas no MusicBrainz...</p>}
      {tracks?.length === 0 && <HandNote className="mt-2">Ainda não temos as faixas deste disco.</HandNote>}
      {tracks &&
        discs.map((disc) => (
          <div key={disc} className="card mt-4 px-4">
            {discs.length > 1 && <h3 className="border-b border-line/60 py-2.5 text-sm font-bold text-accent">Disco {disc}</h3>}
            <ol className="divide-y divide-line/60">
              {tracks
                .filter((t) => t.disc === disc)
                .map((t) => (
                  <TrackRow
                    key={`${t.disc}-${t.number}`}
                    album={album}
                    track={t}
                    onSaved={(saved) => setTracks(tracks.map((x) => (x.disc === saved.disc && x.number === saved.number ? saved : x)))}
                  />
                ))}
            </ol>
          </div>
        ))}
    </section>
  );
}
