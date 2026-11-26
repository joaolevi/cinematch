import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import Poster from "../components/Poster";
import { StarsDisplay } from "../components/Stars";
import { Avatar } from "../components/WatchedBy";
import { formatDate, localDate, plural, timeAgo } from "../format";
import type { CommunityEntry, Person, Reviewer, SuggestedPerson } from "../types";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import PeopleSearch from "../components/PeopleSearch";
import ReviewTalk from "../components/ReviewTalk";
import SpoilerText from "../components/SpoilerText";

const PAGE = 20;

/** Quando foi: "hoje", "ontem", "em 3/11/2026" ou, sem data, há quanto tempo foi registrado. */
function when(entry: CommunityEntry): string {
  if (!entry.consumed_at) return timeAgo(entry.created_at);
  if (entry.consumed_at === localDate()) return "hoje";
  if (entry.consumed_at === localDate(1)) return "ontem";
  return `em ${formatDate(entry.consumed_at)}`;
}

function verb(entry: CommunityEntry): string {
  if (entry.status === "watching") return entry.season ? `está assistindo a temporada ${entry.season} de` : "está assistindo";
  return entry.media.type === "album" ? "ouviu" : entry.consumed_at ? "viu" : "registrou";
}

/**
 * Uma resenha, como nas resenhas populares do Letterboxd: o pôster pequeno à esquerda; o título e o ano; quem escreveu,
 * com a nota e quando; o texto; e curtir e comentar. Sem caixa em volta: uma linha fina separa uma da outra.
 */
function ReviewPost({ entry }: { entry: CommunityEntry }) {
  const link = `/media/${entry.media.id}`;
  return (
    <article className="flex gap-4 py-6 sm:gap-5">
      <Link to={link} className="w-16 shrink-0 self-start sm:w-[4.5rem]" aria-label={entry.media.title}>
        <Poster media={entry.media} compact rounded="rounded-md" />
      </Link>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl leading-snug font-bold">
          <Link to={link} className="hover:text-accent">
            {entry.media.title}
          </Link>{" "}
          {entry.media.year && <span className="text-base font-normal text-muted">{entry.media.year}</span>}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <Link to={`/pessoas/${entry.user_id}`} className="flex items-center gap-2 font-semibold text-stone-200 hover:text-accent">
            <Avatar name={entry.user_name} userId={entry.user_id} size="h-6 w-6 text-xs" />
            {entry.user_name}
          </Link>
          {entry.rating != null && <StarsDisplay value={entry.rating} size={14} />}
          <span>{when(entry)}</span>
        </div>
        <SpoilerText text={entry.review!} spoiler={entry.spoiler} className="mt-3 leading-relaxed text-stone-200" />
        <ReviewTalk entry={entry} />
      </div>
    </article>
  );
}

/** Um registro sem resenha: uma linha só, como no feed de atividade. "Davi viu Matrix ★★★★★ · ontem" */
function LogLine({ entry }: { entry: CommunityEntry }) {
  const link = `/media/${entry.media.id}`;
  return (
    <article className="flex items-center gap-3 py-3 text-sm">
      <Link to={`/pessoas/${entry.user_id}`} aria-label={`Perfil de ${entry.user_name}`}>
        <Avatar name={entry.user_name} userId={entry.user_id} size="h-7 w-7 text-xs" />
      </Link>
      <p className="min-w-0 flex-1 text-muted">
        <Link to={`/pessoas/${entry.user_id}`} className="font-semibold text-stone-200 hover:text-accent">
          {entry.user_name}
        </Link>{" "}
        {verb(entry)}{" "}
        <Link to={link} className="font-semibold text-stone-200 hover:text-accent">
          {entry.media.title}
        </Link>
        {entry.rating != null && (
          <span className="ml-2 inline-block align-[-2px]">
            <StarsDisplay value={entry.rating} size={12} />
          </span>
        )}
        <span> · {when(entry)}</span>
      </p>
      <Link to={link} className="w-8 shrink-0" aria-hidden tabIndex={-1}>
        <Poster media={entry.media} compact rounded="rounded-sm" />
      </Link>
    </article>
  );
}

/** Título das seções das laterais: discreto, em versalete, como no Letterboxd. */
function SideTitle({ children }: { children: string }) {
  return <h2 className="border-b border-line/60 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">{children}</h2>;
}

/** Quem eu sigo, com o link para o perfil de cada pessoa (RFF09). */
function Following({ people }: { people: Person[] }) {
  return (
    <section aria-label="Pessoas que sigo">
      <SideTitle>Pessoas que sigo</SideTitle>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Ninguém ainda. Procure alguém pelo nome ou abra o perfil de quem escreveu uma resenha.</p>
      ) : (
        <ul className="mt-2">
          {people.map((person) => (
            <li key={person.id}>
              <Link to={`/pessoas/${person.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 font-semibold hover:bg-surface-2 hover:text-accent">
                <Avatar name={person.name} userId={person.id} size="h-8 w-8" />
                <span className="truncate">{person.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Quem seguir (RFF15): pessoas de gosto parecido que eu ainda não sigo. */
function Suggestions({ people, onFollow }: { people: SuggestedPerson[]; onFollow: (p: SuggestedPerson) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  if (people.length === 0) return null;
  return (
    <section aria-label="Gosto parecido com o seu">
      <SideTitle>Gosto parecido com o seu</SideTitle>
      <ul className="mt-2">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-2 py-2">
            <Link to={`/pessoas/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent">
              <Avatar name={person.name} userId={person.id} size="h-9 w-9" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{person.name}</span>
                <span className="block text-xs text-muted">Vocês combinam {person.percent}%</span>
              </span>
            </Link>
            <button
              className="btn-ghost shrink-0 px-3 py-1 text-xs"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(person.id);
                try {
                  await api.follow(person.id);
                  onFollow(person);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === person.id ? "Seguindo..." : "Seguir"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** O rank de quem escreve, pelas curtidas recebidas (RFF30). */
function Reviewers({ people }: { people: Reviewer[] }) {
  if (people.length === 0) return null;
  return (
    <section aria-label="Resenhas mais curtidas">
      <SideTitle>Resenhas mais curtidas</SideTitle>
      <ol className="mt-2">
        {people.map((person, i) => (
          <li key={person.id}>
            <Link to={`/pessoas/${person.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 hover:text-accent">
              <span className="w-4 text-right text-xs font-bold text-muted tabular-nums">{i + 1}</span>
              <Avatar name={person.name} userId={person.id} size="h-9 w-9" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{person.name}</span>
                <span className="block text-xs text-muted">
                  {plural(person.likes, "curtida", "curtidas")}, {plural(person.reviews, "resenha", "resenhas")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Comunidade: o que as pessoas andam vendo, de todo mundo ou só de quem eu sigo (RFF09). */
export default function CommunityPage() {
  usePageTitle("Comunidade");
  const [params, setParams] = useSearchParams();
  const onlyFollowing = params.get("quem") === "sigo";
  const [people, setPeople] = useState<Person[]>([]);
  const mode = useRef(onlyFollowing); // descarta a página que chegar depois de trocar o filtro
  const [entries, setEntries] = useState<CommunityEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [suggested, setSuggested] = useState<SuggestedPerson[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const fetching = useRef(false);

  useEffect(() => {
    api.reviewers().then(setReviewers).catch(() => {});
    api.following().then(setPeople).catch(() => {});
    api.suggestions().then(setSuggested).catch(() => {});
  }, []);

  function showFollowing(only: boolean) {
    if (only === onlyFollowing) return;
    mode.current = only;
    setParams(only ? { quem: "sigo" } : {}, { replace: true });
    setEntries(null);
    setHasMore(true);
    setFailed(false);
  }

  const loadMore = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const loaded = entries ?? [];
      const page = await api.community(PAGE, loaded.at(-1)?.id, onlyFollowing);
      if (mode.current !== onlyFollowing) return;
      setEntries([...loaded, ...page.items]);
      setHasMore(page.items.length === PAGE);
    } catch {
      setFailed(true);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [entries, onlyFollowing]);

  useEffect(() => {
    const target = bottom.current;
    if (!target || !hasMore || failed || loading) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, failed, loading, loadMore]);

  const followed = (p: SuggestedPerson) => {
    setSuggested((all) => all.filter((x) => x.id !== p.id));
    setPeople((all) => [...all, { id: p.id, name: p.name }].sort((a, b) => a.name.localeCompare(b.name)));
  };

  return (
    <div>
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold">Comunidade</h1>
        <p className="mt-1 text-muted">O que a galera anda vendo e ouvindo.</p>
        <p className="mt-0.5 text-sm text-muted">
          Quem vê os seus registros, você escolhe em{" "}
          <Link to="/conta#quem-ve" className="whitespace-nowrap underline hover:text-accent">
            Minha conta
          </Link>
          .
        </p>
        <div className="mt-5 inline-flex rounded-full border border-line bg-bg/40 p-1" role="group" aria-label="De quem ver os registros">
          {(
            [
              [false, "Todo mundo"],
              [true, "Quem eu sigo"],
            ] as const
          ).map(([only, label]) => (
            <button
              key={label}
              onClick={() => showFollowing(only)}
              aria-pressed={onlyFollowing === only}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                onlyFollowing === only ? "bg-accent text-bg" : "text-stone-300 hover:text-cream"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Três colunas nas telas largas: pessoas à esquerda, o feed no centro, sugestões à direita. Abaixo disso, o feed
          vem primeiro e as laterais depois, menos a busca de pessoas, que fica no topo */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[15rem_minmax(0,40rem)_15rem] xl:justify-center xl:gap-12">
        <div className="mx-auto w-full max-w-2xl space-y-10 max-xl:order-2 xl:sticky xl:top-24 xl:self-start">
          <div className="hidden xl:block">
            <PeopleSearch />
          </div>
          <Following people={people} />
        </div>

        <section className="mx-auto w-full max-w-2xl xl:max-w-none" aria-label="Registros recentes">
          <div className="mb-6 xl:hidden">
            <PeopleSearch />
          </div>
          {onlyFollowing && entries?.length === 0 && !hasMore && (
            <p className="text-center text-muted">
              {people.length === 0
                ? "Você ainda não segue ninguém. Procure alguém pelo nome ou veja as sugestões de gosto parecido."
                : "Quem você segue ainda não registrou nada."}
            </p>
          )}
          {!onlyFollowing && entries?.length === 0 && !hasMore && (
            <p className="text-center text-muted">
              Ainda não tem nada por aqui. Marque "Já vi" no{" "}
              <Link to="/para-voce" className="text-accent underline">
                Para você
              </Link>{" "}
              e seja a primeira pessoa!
            </p>
          )}
          <div className="divide-y divide-line/60 border-t border-line/60">
            {entries?.map((e) => (e.review ? <ReviewPost key={e.id} entry={e} /> : <LogLine key={e.id} entry={e} />))}
          </div>
          <div ref={bottom} />
          {loading && <HandNote className="mt-8 text-center">Procurando o que a galera anda vendo...</HandNote>}
          {failed && (
            <div className="mt-8 text-center">
              <p className="text-sm text-muted">Não conseguimos carregar a Comunidade agora.</p>
              <button className="btn-ghost mt-3" onClick={loadMore}>
                Tentar de novo
              </button>
            </div>
          )}
        </section>

        <div className="mx-auto w-full max-w-2xl space-y-10 max-xl:order-3 xl:sticky xl:top-24 xl:self-start">
          <Suggestions people={suggested} onFollow={followed} />
          <Reviewers people={reviewers} />
        </div>
      </div>
    </div>
  );
}
