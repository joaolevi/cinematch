import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import Carousel from "../components/Carousel";
import HandNote from "../components/HandNote";
import MediaCard from "../components/MediaCard";
import { StarsDisplay } from "../components/Stars";
import { Avatar } from "../components/WatchedBy";
import { plural } from "../format";
import type { Media, Profile, Recommendation } from "../types";
import { usePageTitle } from "../usePageTitle";

function Row({ label, items }: { label: string; items: { media: Media; rating?: number | null }[] }) {
  return (
    <Carousel label={label}>
      {items.map(({ media, rating }) => (
        <div key={media.id} className="w-36 shrink-0 snap-start sm:w-40">
          <MediaCard media={media} compact>
            {rating != null && (
              <div className="mt-1">
                <StarsDisplay value={rating} size={13} />
              </div>
            )}
          </MediaCard>
        </div>
      ))}
    </Carousel>
  );
}

/** "ficção científica, drama e ação": a lista em português, com "e" antes do último. */
function listaDeGeneros(genres: string[]): string {
  const words = genres.map((g) => (g === g.toUpperCase() ? g : g.toLowerCase()));
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} e ${words[words.length - 1]}` : words[0];
}

/** Perfil de uma pessoa, aberto pela Comunidade, com a compatibilidade de gosto (RFF15). */
export default function ProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [together, setTogether] = useState<Recommendation[] | null>(null);
  const [loadingTogether, setLoadingTogether] = useState(false);

  useEffect(() => {
    setProfile(null);
    setTogether(null);
    api.profile(Number(id)).then(setProfile).catch((e) => setError((e as Error).message));
    window.scrollTo(0, 0);
  }, [id]);

  usePageTitle(profile?.name);

  if (error) return <HandNote>{error}</HandNote>;
  if (!profile) return <HandNote>Abrindo o diário desta pessoa...</HandNote>;

  const { counts, compatibility: c } = profile;
  const total = counts.movie + counts.series + counts.album;
  const parts = [
    counts.movie && plural(counts.movie, "filme", "filmes"),
    counts.series && plural(counts.series, "série", "séries"),
    counts.album && plural(counts.album, "álbum", "álbuns"),
  ].filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={profile.name} size="h-16 w-16 text-2xl" />
        <div>
          <h1 className="text-3xl font-bold">{profile.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {total > 0 ? `No diário: ${parts.join(", ")}` : "Ainda não registrou nada no diário"}
          </p>
        </div>
      </div>

      {profile.is_me && <p className="mt-4 text-sm text-muted">Este é o seu perfil, do jeito que as outras pessoas veem.</p>}

      {c && (
        <section className="paper relative mt-8 max-w-3xl -rotate-[0.4deg] rounded-sm py-6 pr-6 pl-14">
          {c.percent != null ? (
            <>
              <p className="font-hand text-3xl leading-none font-bold text-[#b9452f]">Vocês combinam {c.percent}%</p>
              <p className="mt-2 font-semibold text-stone-800">{c.label}</p>
              {c.genres.length > 0 && (
                <p className="mt-2 text-sm text-stone-600">Vocês curtem {listaDeGeneros(c.genres)}.</p>
              )}
            </>
          ) : (
            <p className="font-hand text-2xl leading-none font-bold text-[#b9452f]">{c.label}</p>
          )}
        </section>
      )}

      {c && c.shared.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Em comum</h2>
          <p className="mt-1 text-sm text-muted">O que vocês curtiram em comum, nas três mídias.</p>
          <div className="mt-4">
            <Row label="em comum" items={c.shared.map((media) => ({ media }))} />
          </div>
        </section>
      )}

      {!profile.is_me && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Para ver ou ouvir junto</h2>
          <p className="mt-1 text-sm text-muted">
            Filmes, séries e álbuns que agradam a você e a {profile.name.split(" ")[0]}, sem nada que alguém já tenha visto.
          </p>
          {together === null ? (
            <button
              className="btn-primary mt-4"
              disabled={loadingTogether}
              onClick={async () => {
                setLoadingTogether(true);
                try {
                  setTogether(await api.together(profile.id));
                } finally {
                  setLoadingTogether(false);
                }
              }}
            >
              {loadingTogether ? "Procurando..." : "Ver sugestões para vocês"}
            </button>
          ) : together.length === 0 ? (
            <HandNote className="mt-4">Ainda não dá para sugerir: registrem mais coisas no diário.</HandNote>
          ) : (
            <div className="mt-4">
              <Carousel label="para ver ou ouvir junto">
                {together.map((r) => (
                  <div key={r.media.id} className="w-40 shrink-0 snap-start sm:w-44">
                    <MediaCard media={r.media}>
                      <p className="mt-1 line-clamp-4 text-xs text-muted" title={r.reason}>
                        {r.reason}
                      </p>
                    </MediaCard>
                  </div>
                ))}
              </Carousel>
            </div>
          )}
        </section>
      )}

      {profile.favorites.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Mais bem avaliados</h2>
          <div className="mt-4">
            <Row label="mais bem avaliados" items={profile.favorites} />
          </div>
        </section>
      )}

      {profile.recent.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Registrados por último</h2>
          <div className="mt-4">
            <Row label="registrados por último" items={profile.recent} />
          </div>
        </section>
      )}
    </div>
  );
}
