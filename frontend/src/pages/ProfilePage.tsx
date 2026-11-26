import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Carousel from "../components/Carousel";
import HandNote from "../components/HandNote";
import MediaCard from "../components/MediaCard";
import { StarsDisplay } from "../components/Stars";
import TasteChartsView from "../components/TasteCharts";
import { Avatar } from "../components/WatchedBy";
import { plural } from "../format";
import { genreTeam, matches, notesOf, tasteCharts, tasteOf, type DiaryFilter } from "../taste";
import type { DiaryEntry, Media, Person, Profile, Recommendation } from "../types";
import { MEDIA_GRID, TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

const INK = "text-[#2b211c]";
const RED_INK = "text-[#b9452f]";
const NOTE_TILT = [-3, 2, -1.5, 2.5, -2, 1.5];

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

const sameItems = (a: { media: Media }[], b: { media: Media }[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.media.id === x.media.id));

/** Perfil de uma pessoa (RFF11): a história do gosto dela, como no diário, mais o que vocês têm em comum (RFF15) e as
 * sugestões para ver junto (RFF28). Os números e os gráficos saem do diário da pessoa, calculados aqui. */
export default function ProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [together, setTogether] = useState<Recommendation[] | null>(null);
  const [loadingTogether, setLoadingTogether] = useState(false);
  const [following, setFollowing] = useState(false); // enquanto o Seguir é salvo
  const [filter, setFilter] = useState<DiaryFilter | null>(null); // a barra clicada nos gráficos
  // A lista aberta pelos números: quem segue a pessoa ou quem ela segue (RFF09)
  const [people, setPeople] = useState<{ kind: "followers" | "follows"; list: Person[] | null } | null>(null);

  async function load(personId: number) {
    const found = await api.profile(personId);
    setProfile(found);
    setEntries(found.restricted ? [] : await api.personDiary(personId).catch(() => []));
  }

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
    setEntries(null);
    setTogether(null);
    setPeople(null);
    setFilter(null);
    load(Number(id)).catch((e) => setError((e as Error).message));
    window.scrollTo(0, 0);
  }, [id]);

  const first = profile?.name.split(" ")[0] ?? "";
  const who = profile && !profile.is_me ? first : undefined;
  const counted = useMemo(() => (entries ?? []).filter((e) => !e.from_onboarding), [entries]);
  const taste = useMemo(() => tasteOf(entries ?? [], who), [entries, who]);
  const notes = useMemo(() => notesOf(entries ?? [], new Date(), who), [entries, who]);
  const charts = useMemo(() => tasteCharts(entries ?? []), [entries]);
  const picked = useMemo(() => (filter ? (entries ?? []).filter((e) => matches(e, filter)) : []), [entries, filter]);

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
  const subject = profile.is_me ? "você" : first;

  return (
    <div className="space-y-10">
      {/* Cabeçalho: a folha do diário da pessoa, com quem é, a frase do gosto e os números em post-its */}
      <section className="paper relative -rotate-[0.3deg] rounded-sm py-7 pr-6 pl-14 sm:pr-8 sm:pl-16">
        <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
        <span aria-hidden className="tape -top-2.5 right-16 rotate-3" style={{ background: TAPE_COLORS[2] }} />
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className={INK}>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={profile.name} userId={profile.id} size="h-16 w-16 text-2xl" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-3xl font-bold sm:text-4xl">{profile.name}</h1>
                <p className="mt-1 text-sm text-stone-600">
                  {profile.restricted
                    ? "O diário é só para quem segue"
                    : total > 0
                      ? `No diário: ${parts.join(", ")}`
                      : "Ainda não registrou nada no diário"}
                </p>
                <p className="mt-0.5 text-sm text-stone-600">
                  {profile.followers ? (
                    <button
                      className="cursor-pointer underline underline-offset-2 hover:text-[#b9452f]"
                      aria-expanded={people?.kind === "followers"}
                      onClick={() => showPeople("followers")}
                    >
                      {plural(profile.followers, "pessoa segue", "pessoas seguem")} {subject}
                    </button>
                  ) : (
                    `ninguém segue ${subject} ainda`
                  )}{" "}
                  ·{" "}
                  {profile.follows ? (
                    <button
                      className="cursor-pointer underline underline-offset-2 hover:text-[#b9452f]"
                      aria-expanded={people?.kind === "follows"}
                      onClick={() => showPeople("follows")}
                    >
                      {subject} segue {plural(profile.follows, "pessoa", "pessoas")}
                    </button>
                  ) : (
                    `${subject} não segue ninguém`
                  )}
                </p>
              </div>
              {!profile.is_me && (
                <button
                  className={profile.following ? "btn-ghost" : "btn-primary"}
                  disabled={following}
                  onClick={async () => {
                    setFollowing(true);
                    try {
                      await (profile.following ? api.unfollow(profile.id) : api.follow(profile.id));
                      // Recarrega: seguir pode liberar o diário de quem só mostra para quem segue (RFF10)
                      await load(profile.id);
                      setTogether(null);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setFollowing(false);
                    }
                  }}
                >
                  {profile.following ? "Deixar de seguir" : `Seguir ${first}`}
                </button>
              )}
            </div>

            {profile.badges.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Selos">
                {profile.badges.map((b) => (
                  <li
                    key={b.month}
                    title={`Desafio do tema "${b.title}", ${b.month.split("-").reverse().join("/")}`}
                    className="chip px-3 py-1 text-sm"
                  >
                    <span aria-hidden>🏅</span> {b.badge}
                  </li>
                ))}
              </ul>
            )}

            {taste && (
              <div className="mt-6">
                <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>
                  {who ? `O gosto de ${who} em uma frase:` : "Meu gosto em uma frase:"}
                </p>
                <p className="mt-1 max-w-3xl font-display text-2xl leading-tight font-bold sm:text-3xl">
                  {who ? "Do time" : "Sou do time"} <mark className="marker">{taste.highlight}</mark>
                  {taste.decade && (
                    <>
                      {" "}
                      dos{" "}
                      <mark className="marker" style={{ "--marker": "rgb(232 115 90 / 0.5)" } as CSSProperties}>
                        {taste.decade}
                      </mark>
                    </>
                  )}
                  .
                </p>
                <ul className="mt-3 font-hand text-2xl leading-8 font-semibold opacity-85">
                  {taste.facts.map((fact) => (
                    <li key={fact}>→ {fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {profile.is_me && (
              <p className="mt-4 text-sm text-stone-600">
                {
                  {
                    all: "Este é o seu perfil, do jeito que as outras pessoas veem.",
                    followers: "Este é o seu perfil. Só quem segue você vê o seu diário.",
                    private: "Este é o seu perfil. Só você vê o seu diário.",
                  }[user?.visibility ?? "all"]
                }{" "}
                <Link to="/conta#quem-ve" className="underline hover:text-[#b9452f]">
                  Escolher quem vê
                </Link>
              </p>
            )}
            {profile.is_me && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/conta#perfil" className="btn-ghost px-3 py-1 text-sm">
                  Trocar a foto e o nome
                </Link>
                <Link to="/diario" className="btn-ghost px-3 py-1 text-sm">
                  Abrir o meu diário para registrar
                </Link>
              </div>
            )}
          </div>

          {!profile.restricted && counted.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:gap-4 lg:w-[27rem]" aria-label="Números do diário">
              {notes.map((note, i) => (
                <li
                  key={note.label}
                  className="postit flex aspect-square flex-col justify-center px-2 py-3 text-center sm:px-3"
                  style={{ "--note": note.color, rotate: `${NOTE_TILT[i % NOTE_TILT.length]}deg` } as CSSProperties}
                >
                  <span className="font-hand text-4xl leading-none font-bold sm:text-5xl">{note.value}</span>
                  <span className="mt-1 font-hand text-base leading-4 font-semibold sm:text-lg sm:leading-5">
                    {note.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {people && (
        <section className="card max-w-3xl p-4" aria-label={people.kind === "followers" ? "Quem segue" : "Quem é seguido"}>
          <h2 className="text-sm font-semibold">
            {people.kind === "followers" ? `Quem segue ${subject}` : `Quem ${profile.is_me ? "você segue" : `${first} segue`}`}
          </h2>
          {people.list === null ? (
            <p className="mt-2 text-sm text-muted">Abrindo a lista...</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {people.list.map((p) => (
                <li key={p.id}>
                  <Link to={`/pessoas/${p.id}`} className="flex items-center gap-2 text-sm font-semibold hover:text-accent">
                    <Avatar name={p.name} userId={p.id} size="h-8 w-8" />
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {profile.restricted && (
        <HandNote>
          {first} só mostra o que registra para quem segue. Siga para ver o diário e o que vocês têm em comum.
        </HandNote>
      )}

      {/* Com outra pessoa: o quanto vocês combinam e o que ver junto, lado a lado nas telas largas */}
      {c && !profile.restricted && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section className="paper relative -rotate-[0.4deg] self-start rounded-sm py-6 pr-6 pl-14">
            {c.percent != null ? (
              <>
                <p className="font-hand text-3xl leading-none font-bold text-[#b9452f]">Vocês combinam {c.percent}%</p>
                <p className="mt-2 font-semibold text-stone-800">{c.label}</p>
                {c.genres.length > 0 && (
                  <p className="mt-2 text-sm text-stone-600">Vocês são do time {listaDeGeneros(c.genres)}.</p>
                )}
                {c.shared.length > 0 && (
                  <p className="mt-2 text-sm text-stone-600">
                    Em comum: {c.shared.slice(0, 4).map((m) => m.title).join(", ")}
                    {c.shared.length > 4 && ` e mais ${c.shared.length - 4}`}.
                  </p>
                )}
              </>
            ) : (
              <p className="font-hand text-2xl leading-none font-bold text-[#b9452f]">{c.label}</p>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Para ver ou ouvir junto</h2>
            <p className="mt-1 text-sm text-muted">
              Filmes, séries e álbuns que agradam a você e a {first}, sem nada que alguém já tenha visto.
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
        </div>
      )}

      {profile.recent.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold">Registrados por último</h2>
          <div className="mt-4">
            <Row label="registrados por último" items={profile.recent} />
          </div>
        </section>
      )}

      {/* Com poucos registros, as duas fileiras seriam iguais: fica só a de cima */}
      {profile.favorites.length > 0 && !sameItems(profile.favorites, profile.recent) && (
        <section>
          <h2 className="font-display text-xl font-bold">Mais bem avaliados</h2>
          <div className="mt-4">
            <Row label="mais bem avaliados" items={profile.favorites} />
          </div>
        </section>
      )}

      {!profile.restricted && entries && entries.length > 0 && (
        <section aria-label="A história do gosto em números">
          <h2 className="font-display text-xl font-bold">A história do gosto em números</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Clique numa barra para ver esses títulos.</p>
          <TasteChartsView data={charts} onPick={setFilter} who={who} />
          {filter && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-lg font-bold">
                  {filter.label}: {plural(picked.length, "título", "títulos")}
                </h3>
                <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setFilter(null)}>
                  Fechar a lista
                </button>
              </div>
              <div className={`mt-4 ${MEDIA_GRID}`}>
                {picked.map((e) => (
                  <MediaCard key={e.id} media={e.media} compact>
                    {e.rating != null && (
                      <div className="mt-1">
                        <StarsDisplay value={e.rating} size={13} />
                      </div>
                    )}
                  </MediaCard>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
