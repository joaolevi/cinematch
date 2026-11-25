import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Carousel from "../components/Carousel";
import HandNote from "../components/HandNote";
import MediaCard from "../components/MediaCard";
import { StarsDisplay } from "../components/Stars";
import { Avatar } from "../components/WatchedBy";
import { plural } from "../format";
import { genreTeam } from "../taste";
import type { Media, Person, Profile, Recommendation } from "../types";
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

/** "da ficção científica, do drama e da MPB": os gêneros com o artigo, com "e" antes do último. */
function listaDeGeneros(genres: string[]): string {
  const words = genres.map(genreTeam);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} e ${words[words.length - 1]}` : words[0];
}

/** Perfil de uma pessoa, aberto pela Comunidade, com a compatibilidade de gosto (RFF15). */
export default function ProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [together, setTogether] = useState<Recommendation[] | null>(null);
  const [loadingTogether, setLoadingTogether] = useState(false);
  const [following, setFollowing] = useState(false); // enquanto o Seguir é salvo
  // A lista aberta pelos números: quem segue a pessoa ou quem ela segue (RFF09)
  const [people, setPeople] = useState<{ kind: "followers" | "follows"; list: Person[] | null } | null>(null);

  async function showPeople(kind: "followers" | "follows") {
    if (people?.kind === kind) return setPeople(null);
    setPeople({ kind, list: null });
    try {
      const list = await (kind === "followers" ? api.followers(Number(id)) : api.follows(Number(id)));
      setPeople((current) => (current?.kind === kind ? { kind, list } : current));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    setProfile(null);
    setTogether(null);
    setPeople(null);
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
            {profile.restricted
              ? "O diário é só para quem segue"
              : total > 0
                ? `No diário: ${parts.join(", ")}`
                : "Ainda não registrou nada no diário"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {profile.followers ? (
              <button
                className="cursor-pointer underline-offset-2 hover:text-accent hover:underline"
                aria-expanded={people?.kind === "followers"}
                onClick={() => showPeople("followers")}
              >
                {plural(profile.followers, "pessoa segue", "pessoas seguem")}
              </button>
            ) : (
              "ninguém segue ainda"
            )}{" "}
            ·{" "}
            {profile.follows ? (
              <button
                className="cursor-pointer underline-offset-2 hover:text-accent hover:underline"
                aria-expanded={people?.kind === "follows"}
                onClick={() => showPeople("follows")}
              >
                segue {plural(profile.follows, "pessoa", "pessoas")}
              </button>
            ) : (
              "não segue ninguém"
            )}
          </p>
        </div>
        {!profile.is_me && (
          <button
            className={profile.following ? "btn-ghost" : "btn-primary"}
            disabled={following}
            onClick={async () => {
              setFollowing(true);
              const now = !profile.following;
              try {
                await (now ? api.follow(profile.id) : api.unfollow(profile.id));
                // Recarrega: seguir pode liberar o diário de quem só mostra para quem segue (RFF10)
                setProfile(await api.profile(profile.id));
                setTogether(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setFollowing(false);
              }
            }}
          >
            {profile.following ? "Deixar de seguir" : "Seguir"}
          </button>
        )}
      </div>

      {people && (
        <section className="card mt-4 max-w-3xl p-4" aria-label={people.kind === "followers" ? "Quem segue" : "Quem é seguido"}>
          <h2 className="text-sm font-semibold">
            {people.kind === "followers" ? `Quem segue ${profile.is_me ? "você" : profile.name.split(" ")[0]}` : `Quem ${profile.is_me ? "você segue" : `${profile.name.split(" ")[0]} segue`}`}
          </h2>
          {people.list === null ? (
            <p className="mt-2 text-sm text-muted">Abrindo a lista...</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {people.list.map((p) => (
                <li key={p.id}>
                  <Link to={`/pessoas/${p.id}`} className="flex items-center gap-2 text-sm font-semibold hover:text-accent">
                    <Avatar name={p.name} size="h-8 w-8" />
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {profile.is_me && (
        <p className="mt-4 text-sm text-muted">
          {
            {
              all: "Este é o seu perfil, do jeito que as outras pessoas veem.",
              followers: "Este é o seu perfil. Só quem segue você vê o seu diário.",
              private: "Este é o seu perfil. Só você vê o seu diário.",
            }[user?.visibility ?? "all"]
          }{" "}
          <Link to="/conta#quem-ve" className="underline hover:text-accent">
            Escolher quem vê
          </Link>
        </p>
      )}

      {profile.restricted && (
        <HandNote className="mt-8">
          {profile.name.split(" ")[0]} só mostra o que registra para quem segue. Siga para ver o diário e o que vocês têm em
          comum.
        </HandNote>
      )}

      {c && (
        <section className="paper relative mt-8 max-w-3xl -rotate-[0.4deg] rounded-sm py-6 pr-6 pl-14">
          {c.percent != null ? (
            <>
              <p className="font-hand text-3xl leading-none font-bold text-[#b9452f]">Vocês combinam {c.percent}%</p>
              <p className="mt-2 font-semibold text-stone-800">{c.label}</p>
              {c.genres.length > 0 && (
                <p className="mt-2 text-sm text-stone-600">Vocês são do time {listaDeGeneros(c.genres)}.</p>
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

      {!profile.is_me && !profile.restricted && (
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
