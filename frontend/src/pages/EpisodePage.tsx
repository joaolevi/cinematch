import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import HandNote from "../components/HandNote";
import PartMarker from "../components/PartMarker";
import { Everyone, PartNav } from "../components/PartNav";
import { formatDate, formatMinutes } from "../format";
import { diaryChanged } from "../seen";
import type { EpisodeDetail } from "../types";
import { usePageTitle } from "../usePageTitle";

export const episodePath = (mediaId: number, season: number, episode: number) =>
  `/media/${mediaId}/temporada/${season}/episodio/${episode}`;

/** A página de um episódio: a cena, a sinopse, o que eu achei e o que todo mundo achou, com o anterior e o próximo. */
export default function EpisodePage() {
  const { id, season, episode } = useParams();
  const [ep, setEp] = useState<EpisodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaId = Number(id), s = Number(season), n = Number(episode);

  useEffect(() => {
    setEp(null);
    setError(null);
    api.episode(mediaId, s, n).then(setEp).catch((e) => setError((e as Error).message));
  }, [mediaId, s, n]);

  usePageTitle(ep ? `${ep.series.title} · T${ep.season}E${ep.number}` : undefined);

  if (error)
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold">Não deu para abrir o episódio</h1>
        <HandNote className="mt-2">{error}</HandNote>
        <Link to={`/media/${id}`} className="mt-4 inline-block text-sm font-bold text-accent hover:underline">
          ← Voltar para a série
        </Link>
      </div>
    );
  if (!ep)
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="sr-only">Episódio</h1>
        <HandNote>Abrindo o episódio...</HandNote>
      </div>
    );

  const title = ep.name ?? `Episódio ${ep.number}`;
  const image = ep.still_url ?? ep.series.backdrop_url;
  const meta = [
    ep.air_date && formatDate(ep.air_date),
    ep.runtime && formatMinutes(ep.runtime),
    ep.directors?.length ? `Direção: ${ep.directors.join(", ")}` : null,
  ].filter(Boolean);
  // Na virada de temporada, o rótulo diz para onde vai
  const link = (r: EpisodeDetail["previous"], same: string, other: string) =>
    r && {
      to: episodePath(mediaId, r.season, r.number),
      label: r.season === ep.season ? same : `${other} ${r.season}`,
      title: r.name ?? `Episódio ${r.number}`,
    };

  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Onde estou" className="text-sm text-muted">
        <Link to={`/media/${mediaId}`} className="font-semibold text-accent hover:underline">
          ← {ep.series.title}
        </Link>{" "}
        · Temporada {ep.season}
      </nav>

      {image && (
        <img
          src={image}
          alt=""
          className="mt-4 aspect-video w-full rounded-2xl border border-line/60 object-cover"
        />
      )}

      <header className="mt-6">
        <p className="font-hand text-xl font-bold text-accent">
          Temporada {ep.season} · Episódio {ep.number}
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {meta.length > 0 && <p className="mt-2 text-sm text-muted">{meta.join(" · ")}</p>}
        {ep.overview && <p className="mt-4 max-w-3xl leading-relaxed text-stone-200">{ep.overview}</p>}
      </header>

      <div className="mt-8">
        <PartMarker
          key={`${s}-${n}`}
          value={ep}
          album={false}
          label="este episódio"
          save={async (data) => {
            const saved = await api.rateEpisode(mediaId, s, n, data);
            diaryChanged();
            return saved;
          }}
        />
      </div>

      <Everyone average={ep.average} ratings={ep.ratings} seenBy={ep.seen_by} album={false} />
      <PartNav
        previous={link(ep.previous, "Episódio anterior", "Fim da temporada")}
        next={link(ep.next, "Próximo episódio", "Começo da temporada")}
      />
    </div>
  );
}
