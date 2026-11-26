import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import HandNote from "../components/HandNote";
import PartMarker from "../components/PartMarker";
import { Everyone, PartNav } from "../components/PartNav";
import Poster from "../components/Poster";
import { formatSeconds, SEARCH_URL, SERVICE_LABEL } from "../format";
import type { TrackDetail } from "../types";
import { usePageTitle } from "../usePageTitle";

export const trackPath = (mediaId: number, disc: number, number: number) => `/media/${mediaId}/faixa/${disc}/${number}`;

/** A página de uma faixa: a capa do disco, quem canta, o que eu achei e o que todo mundo achou, com a anterior e a próxima. */
export default function TrackPage() {
  const { id, disc, number } = useParams();
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaId = Number(id), d = Number(disc), n = Number(number);

  useEffect(() => {
    setTrack(null);
    setError(null);
    api.track(mediaId, d, n).then(setTrack).catch((e) => setError((e as Error).message));
  }, [mediaId, d, n]);

  usePageTitle(track ? `${track.title} · ${track.album.title}` : undefined);

  if (error)
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold">Não deu para abrir a faixa</h1>
        <HandNote className="mt-2">{error}</HandNote>
        <Link to={`/media/${id}`} className="mt-4 inline-block text-sm font-bold text-accent hover:underline">
          ← Voltar para o álbum
        </Link>
      </div>
    );
  if (!track)
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="sr-only">Faixa</h1>
        <HandNote>Abrindo a faixa...</HandNote>
      </div>
    );

  const artists = track.artists.length ? track.artists : track.album.creators;
  const query = encodeURIComponent(`${track.title} ${artists[0] ?? ""}`.trim());
  const where = track.discs > 1 ? `Disco ${track.disc} · ` : "";
  const link = (r: TrackDetail["previous"], label: string) =>
    r && { to: trackPath(mediaId, r.disc, r.number), label, title: r.title };

  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Onde estou" className="text-sm text-muted">
        <Link to={`/media/${mediaId}`} className="font-semibold text-accent hover:underline">
          ← {track.album.title}
        </Link>
      </nav>

      <div className="mt-6 grid gap-8 sm:grid-cols-[200px_1fr]">
        <Link to={`/media/${mediaId}`} className="block w-40 sm:w-auto" aria-label={`Abrir o álbum ${track.album.title}`}>
          <Poster media={track.album} rounded="rounded-lg" />
        </Link>
        <header className="min-w-0">
          <p className="font-hand text-xl font-bold text-accent">
            {where}Faixa {track.position} de {track.total}
          </p>
          <h1 className="text-3xl font-bold break-words sm:text-4xl">{track.title}</h1>
          <p className="mt-2 text-stone-200">{artists.join(", ")}</p>
          <p className="mt-1 text-sm text-muted">
            {track.length_sec != null && <>{formatSeconds(track.length_sec)} · </>}
            do álbum{" "}
            <Link to={`/media/${mediaId}`} className="underline hover:text-accent">
              {track.album.title}
            </Link>
            {track.album.year && ` (${track.album.year})`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(SEARCH_URL).map(([service, url]) => (
              <a key={service} href={url(query)} target="_blank" rel="noreferrer" className="chip transition hover:border-accent hover:text-accent">
                Procurar no {SERVICE_LABEL[service] ?? service} ↗
              </a>
            ))}
          </div>
        </header>
      </div>

      <div className="mt-8">
        <PartMarker
          key={`${d}-${n}`}
          value={track}
          album
          label="esta faixa"
          save={(data) => api.rateTrack(mediaId, d, n, data)}
        />
      </div>

      <Everyone average={track.average} ratings={track.ratings} seenBy={track.seen_by} album />
      <PartNav previous={link(track.previous, "Faixa anterior")} next={link(track.next, "Próxima faixa")} />
    </div>
  );
}
