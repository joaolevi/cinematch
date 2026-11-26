import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Carousel from "../components/Carousel";
import HandNote from "../components/HandNote";
import MediaCard from "../components/MediaCard";
import DiaryTable, { groupByMonth } from "../components/DiaryTable";
import PinnedFavorites from "../components/PinnedFavorites";
import { ReviewPost } from "../components/ReviewPost";
import { StarsDisplay } from "../components/Stars";
import TasteChartsView from "../components/TasteCharts";
import { Avatar } from "../components/WatchedBy";
import { formatRating, plural } from "../format";
import { genreTeam, matches, monthOf, notesOf, tasteCharts, tasteOf, type DiaryFilter } from "../taste";
import type { CommunityEntry, DiaryEntry, Media, Person, Profile, Recommendation } from "../types";
import { MEDIA_GRID } from "../ui";
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

const sameItems = (a: { media: Media }[], b: { media: Media }[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.media.id === x.media.id));

const PROFILE_TABS: [ProfileTab, string][] = [
  ["", "Perfil"],
  ["resenhas", "Resenhas"],
  ["diario", "Diário"],
  ["numeros", "Números"],
];
type ProfileTab = "" | "resenhas" | "diario" | "numeros";

/** As notas da pessoa num histograma pequeno, como a lateral do perfil no Letterboxd: a média e a forma das notas. */
function RatingsSummary({ bars, entries }: { bars: { value: number }[]; entries: DiaryEntry[] }) {
  const rated = entries.filter((e) => e.rating != null);
  if (rated.length === 0) return null;
  const avg = rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <section aria-label="Notas">
      <h2 className="border-b border-line/60 pb-1 font-hand text-2xl leading-8 font-bold text-accent">Notas</h2>
      <div className="mt-3 flex items-end gap-3">
        <div aria-hidden className="flex h-14 flex-1 items-end gap-0.5">
          {bars.map((b, i) => (
            <span key={i} className="flex-1 rounded-t-sm bg-stone-500/70" style={{ height: `${Math.max(4, (b.value / max) * 100)}%` }} />
          ))}
        </div>
        <p className="text-right">
          <span className="block font-display text-2xl font-bold">{formatRating(avg)}</span>
          <span className="block text-xs text-muted">{plural(rated.length, "nota", "notas")}</span>
        </p>
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-[10px] text-muted">
        <span>★</span>
        <span>★★★★★</span>
      </div>
    </section>
  );
}

/** Os últimos registros do diário, numa lista curta com o dia, como a lateral "Diário" do Letterboxd. */
function RecentDiary({ entries, to }: { entries: DiaryEntry[]; to: string }) {
  const last = entries.slice(0, 6);
  if (last.length === 0) return null;
  return (
    <section aria-label="Diário recente">
      <h2 className="flex items-baseline justify-between border-b border-line/60 pb-1">
        <span className="font-hand text-2xl leading-8 font-bold text-accent">Diário</span>
        <Link to={to} className="text-xs font-bold text-accent hover:underline">
          Ver tudo →
        </Link>
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {last.map((e) => (
          <li key={e.id} className="flex items-baseline gap-3">
            <span className="w-14 shrink-0 text-xs whitespace-nowrap text-muted">
              {e.consumed_at
                ? new Date(`${e.consumed_at}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                : "–"}
            </span>
            <Link to={`/media/${e.media.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-accent">
              {e.media.title}
            </Link>
            {e.rating != null && <StarsDisplay value={e.rating} size={11} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os números grandes no topo da aba Números, como as estatísticas do Letterboxd. */
function BigNumbers({ entries }: { entries: DiaryEntry[] }) {
  const year = String(new Date().getFullYear());
  const minutes = entries.reduce((sum, e) => sum + (e.media.type !== "series" ? e.media.duration_min ?? 0 : 0), 0);
  const people = new Set(entries.flatMap((e) => e.media.creators)).size;
  const countries = new Set(entries.flatMap((e) => e.media.countries ?? [])).size;
  const numbers: [string, string, string][] = [
    [String(entries.length), "títulos", "no diário"],
    [String(entries.filter((e) => monthOf(e).startsWith(year)).length), "este ano", `em ${year}`],
    [String(Math.round(minutes / 60)), "horas", "de filmes e discos"],
    [String(people), "pessoas", "na direção, na criação e nos discos"],
    ...(countries > 0 ? [[String(countries), countries === 1 ? "país" : "países", "de onde vêm os títulos"] as [string, string, string]] : []),
  ];
  return (
    <dl className="grid grid-cols-2 gap-y-6 border-b border-line/60 pb-8 text-center sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-line/60">
      {numbers.map(([value, label, hint]) => (
        <div key={label} className="flex flex-col px-4" title={hint}>
          <dt className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</dt>
          <dd className="order-first font-display text-4xl font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A aba Resenhas: todas as resenhas da pessoa, as mais novas ou as mais curtidas, de 20 em 20. */
function PersonReviews({ personId, isMe, first }: { personId: number; isMe: boolean; first: string }) {
  const [sort, setSort] = useState<"recentes" | "populares">("recentes");
  const [items, setItems] = useState<CommunityEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const PAGE = 20;

  useEffect(() => {
    setItems(null);
    api
      .personReviews(personId, sort, PAGE, 0)
      .then((page) => {
        setItems(page);
        setMore(page.length === PAGE);
      })
      .catch((e) => setError((e as Error).message));
  }, [personId, sort]);

  return (
    <section aria-label="Resenhas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{isMe ? "Tudo o que você escreveu." : `Tudo o que ${first} escreveu.`}</p>
        <div role="group" aria-label="Ordem das resenhas" className="inline-flex rounded-full border border-line bg-bg/40 p-0.5">
          {(
            [
              ["recentes", "Mais novas"],
              ["populares", "Mais curtidas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={sort === key}
              onClick={() => setSort(key)}
              className={`cursor-pointer rounded-full px-3 py-0.5 text-sm transition ${
                sort === key ? "bg-accent font-bold text-bg" : "text-stone-300 hover:text-cream"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-4 text-red-300">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-muted">Abrindo as resenhas...</p>}
      {items?.length === 0 && <HandNote className="mt-4">Nenhuma resenha ainda.</HandNote>}
      <div className="mx-auto mt-2 max-w-3xl divide-y divide-line/60">
        {items?.map((r) => (
          <ReviewPost key={r.id} entry={r} hideAuthor />
        ))}
      </div>
      {more && items && (
        <div className="mt-6 text-center">
          <button
            className="btn-ghost px-6"
            onClick={async () => {
              const page = await api.personReviews(personId, sort, PAGE, items.length);
              setItems([...items, ...page]);
              setMore(page.length === PAGE);
            }}
          >
            Ver mais resenhas
          </button>
        </div>
      )}
    </section>
  );
}

/** Perfil de uma pessoa (RFF11): a história do gosto dela, como no diário, mais o que vocês têm em comum (RFF15) e as
 * sugestões para ver junto (RFF28). Os números e os gráficos saem do diário da pessoa, calculados aqui. */
export default function ProfilePage() {
  const { id, aba } = useParams();
  const tab: ProfileTab = (["resenhas", "diario", "numeros"] as const).find((t) => t === aba) ?? "";
  const [recentReviews, setRecentReviews] = useState<CommunityEntry[] | null>(null);
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
    setRecentReviews(null);
    load(Number(id)).catch((e) => setError((e as Error).message));
    api
      .personReviews(Number(id), "recentes", 3, 0)
      .then(setRecentReviews)
      .catch(() => setRecentReviews([]));
    window.scrollTo(0, 0);
  }, [id]);

  const first = profile?.name.split(" ")[0] ?? "";
  const who = profile && !profile.is_me ? first : undefined;
  const counted = useMemo(() => (entries ?? []).filter((e) => !e.from_onboarding), [entries]);
  const taste = useMemo(() => tasteOf(entries ?? [], who), [entries, who]);
  const notes = useMemo(() => notesOf(entries ?? [], new Date(), who), [entries, who]);
  const charts = useMemo(() => tasteCharts(entries ?? []), [entries]);
  const reviewCount = useMemo(() => counted.filter((e) => e.review && !e.review_hidden).length, [counted]);
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
      {/* Cabeçalho limpo, como o perfil do Letterboxd: a foto, o nome e os números numa linha. A frase do gosto fica
          embaixo, com o marca-texto, que é a cara do Tastory */}
      <section className="border-b border-line/60 pb-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-5">
          <Avatar name={profile.name} userId={profile.id} size="h-20 w-20 text-3xl sm:h-24 sm:w-24 sm:text-4xl" />
          <div className="min-w-0 flex-1 basis-56">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{profile.name}</h1>
            {profile.badges.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selos">
                {profile.badges.map((b) => (
                  <li
                    key={b.month}
                    title={`Desafio do tema "${b.title}", ${b.month.split("-").reverse().join("/")}`}
                    className="chip px-2.5 py-0.5 text-xs"
                  >
                    <span aria-hidden>🏅</span> {b.badge}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.is_me ? (
                <>
                  <Link to="/conta#perfil" className="btn-ghost px-3 py-1 text-sm">
                    Editar meu perfil
                  </Link>
                  <Link to="/diario" className="btn-ghost px-3 py-1 text-sm">
                    Abrir meu diário
                  </Link>
                </>
              ) : (
                <button
                  className={`px-4 py-1.5 text-sm ${profile.following ? "btn-ghost" : "btn-primary"}`}
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
          </div>

          {/* Os números, como no Letterboxd: grandes, com o nome embaixo, separados por uma linha fina */}
          <dl className="flex divide-x divide-line/60 text-center">
            {!profile.restricted && (
              <div className="flex flex-col px-4 first:pl-0 sm:px-5">
                <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">Títulos</dt>
                <dd className="order-first font-display text-2xl font-bold" title={parts.join(", ")}>{total}</dd>
              </div>
            )}
            {!profile.restricted && counted.length > 0 && (
              <div className="flex flex-col px-4 sm:px-5">
                <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">Este mês</dt>
                <dd className="order-first font-display text-2xl font-bold">{notes[1].value}</dd>
              </div>
            )}
            <div className="flex flex-col px-4 sm:px-5">
              <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">Seguindo</dt>
              <dd className="order-first font-display text-2xl font-bold">
                <button
                  className="cursor-pointer hover:text-accent disabled:cursor-default disabled:hover:text-inherit"
                  aria-expanded={people?.kind === "follows"}
                  aria-label={`${subject === "você" ? "Você segue" : `${first} segue`} ${plural(profile.follows, "pessoa", "pessoas")}`}
                  disabled={!profile.follows}
                  onClick={() => showPeople("follows")}
                >
                  {profile.follows}
                </button>
              </dd>
            </div>
            <div className="flex flex-col px-4 last:pr-0 sm:px-5">
              <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">Seguidores</dt>
              <dd className="order-first font-display text-2xl font-bold">
                <button
                  className="cursor-pointer hover:text-accent disabled:cursor-default disabled:hover:text-inherit"
                  aria-expanded={people?.kind === "followers"}
                  aria-label={`${plural(profile.followers, "pessoa segue", "pessoas seguem")} ${subject}`}
                  disabled={!profile.followers}
                  onClick={() => showPeople("followers")}
                >
                  {profile.followers}
                </button>
              </dd>
            </div>
          </dl>
        </div>

        {profile.restricted ? (
          <p className="mt-6 text-sm text-muted">O diário é só para quem segue.</p>
        ) : (
          taste && (
            <div className="mt-7">
              <p className="font-hand text-xl leading-7 font-bold text-accent">
                {who ? `O gosto de ${who} em uma frase:` : "Meu gosto em uma frase:"}
              </p>
              <p className="mt-1 max-w-3xl font-display text-2xl leading-tight font-bold sm:text-3xl">
                {who ? "Do time" : "Sou do time"} <mark className="marker text-cream" style={{ "--marker": "rgb(242 179 61 / 0.45)" } as CSSProperties}>{taste.highlight}</mark>
                {taste.decade && (
                  <>
                    {" "}
                    dos{" "}
                    <mark className="marker text-cream" style={{ "--marker": "rgb(232 115 90 / 0.45)" } as CSSProperties}>
                      {taste.decade}
                    </mark>
                  </>
                )}
                .
              </p>
              <p className="mt-2 text-sm text-muted">{taste.facts.join(" · ")}</p>
            </div>
          )
        )}

        {profile.is_me && (
          <p className="mt-5 text-xs text-muted">
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

      {/* As seções do perfil, como no Letterboxd: o resumo, as resenhas, o diário e os números, cada um na sua página */}
      <nav aria-label="Seções do perfil" className="flex gap-6 overflow-x-auto border-b border-line/60">
        {PROFILE_TABS.map(([key, label]) => (
          <Link
            key={key}
            to={key ? `/pessoas/${profile.id}/${key}` : `/pessoas/${profile.id}`}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-1 pb-3 text-sm font-semibold transition ${
              tab === key ? "border-accent text-accent" : "border-transparent text-stone-300 hover:text-cream"
            }`}
          >
            {label}
            {key === "resenhas" && reviewCount > 0 && <span className="ml-1.5 text-xs font-normal text-muted">{reviewCount}</span>}
          </Link>
        ))}
      </nav>

      {profile.restricted && (
        <HandNote>
          {first} só mostra o que registra para quem segue. Siga para ver o diário e o que vocês têm em comum.
        </HandNote>
      )}

      {!profile.restricted && tab === "" && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-10">
            <PinnedFavorites
              key={profile.id}
              pinned={profile.pinned}
              isMe={profile.is_me}
              who={first}
              entries={profile.is_me ? entries : null}
            />

            {/* As resenhas em destaque, como no perfil do Letterboxd: as três mais novas e o caminho para todas */}
            <section aria-labelledby="resenhas-recentes">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line/60 pb-2">
                <h2 id="resenhas-recentes" className="font-display text-xl font-bold">
                  Resenhas recentes
                </h2>
                {reviewCount > 3 && (
                  <Link to={`/pessoas/${profile.id}/resenhas`} className="text-sm font-bold text-accent hover:underline">
                    Ver as {reviewCount} resenhas →
                  </Link>
                )}
              </div>
              {recentReviews === null ? (
                <p className="mt-3 text-sm text-muted">Abrindo as resenhas...</p>
              ) : recentReviews.length === 0 ? (
                <HandNote className="mt-3">{profile.is_me ? "Você ainda não escreveu resenhas." : `${first} ainda não escreveu resenhas.`}</HandNote>
              ) : (
                <div className="divide-y divide-line/60">
                  {recentReviews.map((r) => (
                    <ReviewPost key={r.id} entry={r} hideAuthor />
                  ))}
                </div>
              )}
            </section>

            {c && (
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
            )}

            {profile.recent.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold">Registrados por último</h2>
                <div className="mt-4">
                  <Row label="registrados por último" items={profile.recent} />
                </div>
              </section>
            )}

            {/* Os mais bem avaliados só aparecem sem favoritos escolhidos: com eles, a fileira repetiria os mesmos pôsteres */}
            {profile.pinned.length === 0 && profile.favorites.length > 0 && !sameItems(profile.favorites, profile.recent) && (
              <section>
                <h2 className="font-display text-xl font-bold">Mais bem avaliados</h2>
                <div className="mt-4">
                  <Row label="mais bem avaliados" items={profile.favorites} />
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start" aria-label="Resumo">
            {c && (
              <section className="paper relative -rotate-[0.6deg] rounded-sm py-5 pr-5 pl-12">
                {c.percent != null ? (
                  <>
                    <p className="font-hand text-2xl leading-none font-bold text-[#b9452f]">Vocês combinam {c.percent}%</p>
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
            )}
            <RatingsSummary bars={charts.ratings} entries={counted} />
            <RecentDiary entries={counted} to={`/pessoas/${profile.id}/diario`} />
          </aside>
        </div>
      )}

      {!profile.restricted && tab === "resenhas" && <PersonReviews personId={profile.id} isMe={profile.is_me} first={first} />}

      {!profile.restricted && tab === "diario" && (
        <section aria-label="Diário">
          {counted.length === 0 ? (
            <HandNote>Nada no diário ainda.</HandNote>
          ) : (
            <>
              {profile.is_me && (
                <p className="text-sm text-muted">
                  Para editar os registros, abra{" "}
                  <Link to="/diario" className="text-accent underline">
                    o seu diário
                  </Link>
                  .
                </p>
              )}
              <DiaryTable groups={groupByMonth(counted)} />
            </>
          )}
        </section>
      )}

      {!profile.restricted && tab === "numeros" && (
        <>
          <BigNumbers entries={counted} />
          {!profile.restricted && entries && entries.length > 0 && (
            <section aria-label="A história do gosto em números">
              <h2 className="sr-only">A história do gosto em números</h2>
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
        </>
      )}
    </div>
  );
}
