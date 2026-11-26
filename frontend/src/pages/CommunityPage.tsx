import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Avatar } from "../components/WatchedBy";
import { plural } from "../format";
import type { CommunityEntry, Person, Reviewer, SuggestedPerson } from "../types";
import { usePageTitle } from "../usePageTitle";
import CommunityNav from "../components/CommunityNav";
import HandNote from "../components/HandNote";
import { LogLine, ReviewPost } from "../components/ReviewPost";
import PeopleSearch from "../components/PeopleSearch";
import { CountUp } from "../motion";

const PAGE = 20;

/** Título das seções das laterais: escrito à mão, a letra do Tastory, sem folha em volta. */
function SideTitle({ children }: { children: string }) {
  return <h2 className="border-b border-line/60 pb-1 font-hand text-2xl leading-8 font-bold text-accent">{children}</h2>;
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
                <span className="block text-xs text-muted">
                  Vocês combinam{" "}
                  <span className="whitespace-nowrap">
                    <CountUp value={person.percent} />%
                  </span>
                </span>
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
    // O único post-it da Comunidade: o ranking de quem escreve é o destaque da página, como um bilhete colado ao lado
    <section aria-label="Resenhas mais curtidas" className="postit rotate-1 px-5 py-4">
      <h2 className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">Resenhas mais curtidas</h2>
      <ol className="mt-1">
        {people.map((person, i) => (
          <li key={person.id}>
            <Link to={`/pessoas/${person.id}`} className="flex items-center gap-3 rounded-lg py-1.5 hover:text-[#b9452f]">
              <span className="w-4 text-right font-hand text-xl font-bold text-[#b9452f]">{i + 1}</span>
              <Avatar name={person.name} userId={person.id} size="h-9 w-9" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{person.name}</span>
                <span className="block text-xs text-stone-700">
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
        <p className="font-hand text-2xl font-bold text-accent">o que a galera anda vendo e ouvindo</p>
        <p className="mt-0.5 text-sm text-muted">
          Quem vê os seus registros, você escolhe em{" "}
          <Link to="/conta#quem-ve" className="whitespace-nowrap underline hover:text-accent">
            Minha conta
          </Link>
          .
        </p>
        <CommunityNav />
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
