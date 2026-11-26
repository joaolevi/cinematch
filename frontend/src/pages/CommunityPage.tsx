import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import WatchedBy, { Avatar } from "../components/WatchedBy";
import { plural } from "../format";
import type { CommunityEntry, Person, Reviewer, SuggestedPerson } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import ReviewTalk from "../components/ReviewTalk";
import SpoilerText from "../components/SpoilerText";

const PAGE = 20;

function Post({ entry, position }: { entry: CommunityEntry; position: number }) {
  const link = `/media/${entry.media.id}`;
  return (
    <article className="flex gap-4 border-b border-line/60 py-5">
      <Link to={link} className="group w-16 shrink-0 sm:w-20" aria-label={entry.media.title}>
        <Polaroid position={position} small album={entry.media.type === "album"}>
          <Poster media={entry.media} compact rounded="rounded-[1px]" />
        </Polaroid>
      </Link>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg leading-snug font-bold">
          <Link to={link} className="hover:text-accent">
            {entry.media.title}
          </Link>{" "}
          {entry.media.year && <span className="font-normal text-muted">{entry.media.year}</span>}
        </h2>
        <div className="mt-1.5">
          <WatchedBy
            name={entry.user_name}
            userId={entry.user_id}
            rating={entry.rating}
            consumedAt={entry.consumed_at}
            createdAt={entry.created_at}
          />
          {entry.status === "watching" && (
            <p className="mt-1 text-xs text-muted">
              ▶ Ainda assistindo{entry.season ? `, na temporada ${entry.season}` : ""}
            </p>
          )}
        </div>
        {entry.review && (
          <>
            <SpoilerText text={entry.review} spoiler={entry.spoiler} className="mt-2 text-stone-200" />
            <ReviewTalk entry={entry} />
          </>
        )}
      </div>
    </article>
  );
}

/** Quem eu sigo, com o link para o perfil de cada pessoa (RFF09). */
function Following({ people }: { people: Person[] }) {
  return (
    <aside className="paper relative self-start rounded-sm py-5 pr-5 pl-12 lg:-rotate-1">
      <span aria-hidden className="tape -top-2.5 left-1/2 -translate-x-1/2 rotate-2" style={{ background: TAPE_COLORS[2] }} />
      <h2 className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">Pessoas que sigo</h2>
      {people.length === 0 ? (
        <p className="mt-1 text-sm text-stone-700">
          Ninguém ainda. Abra o perfil de alguém pelo nome num registro e toque em Seguir.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-6 lg:block">
          {people.map((person) => (
            <li key={person.id} className="py-2">
              <Link to={`/pessoas/${person.id}`} className="flex items-center gap-3 font-semibold text-stone-800 hover:text-[#b9452f]">
                <Avatar name={person.name} userId={person.id} size="h-9 w-9" />
                <span className="truncate">{person.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** Quem seguir (RFF15): pessoas de gosto parecido que eu ainda não sigo. */
function Suggestions({ people, onFollow }: { people: SuggestedPerson[]; onFollow: (p: SuggestedPerson) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  if (people.length === 0) return null;
  return (
    <aside className="paper relative self-start rounded-sm py-5 pr-5 pl-12 lg:rotate-[0.6deg]">
      <span aria-hidden className="tape -top-2.5 left-1/2 -translate-x-1/2 -rotate-2" style={{ background: TAPE_COLORS[0] }} />
      <h2 className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">Gosto parecido com o seu</h2>
      <ul className="flex flex-wrap gap-x-6 lg:block">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 py-2.5">
            <Link to={`/pessoas/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-stone-800 hover:text-[#b9452f]">
              <Avatar name={person.name} userId={person.id} size="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{person.name}</p>
                <p className="text-xs text-stone-600">Vocês combinam {person.percent}%</p>
              </div>
            </Link>
            <button
              className="shrink-0 cursor-pointer rounded-full border border-[#b9452f] px-3 py-1 text-xs font-bold text-[#b9452f] hover:bg-[#b9452f] hover:text-white"
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
    </aside>
  );
}

function Reviewers({ people }: { people: Reviewer[] }) {
  if (people.length === 0) return null;
  return (
    // O rank de quem escreve, pelas curtidas recebidas (RFF30), fica num bilhete colado ao lado da timeline
    <aside className="paper relative order-first self-start rounded-sm py-5 pr-5 pl-12 lg:order-none lg:rotate-1">
      <span aria-hidden className="tape -top-2.5 left-1/2 -translate-x-1/2 -rotate-3" style={{ background: TAPE_COLORS[1] }} />
      <h2 className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">Resenhas mais curtidas</h2>
      <ul className="flex flex-wrap gap-x-6 lg:block">
        {people.map((person) => (
          <li key={person.id} className="py-3">
            <Link to={`/pessoas/${person.id}`} className="flex items-center gap-3 text-stone-800 hover:text-[#b9452f]">
              <Avatar name={person.name} userId={person.id} size="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{person.name}</p>
                <p className="text-xs text-stone-600">
                  {plural(person.likes, "curtida", "curtidas")}, {plural(person.reviews, "resenha", "resenhas")}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
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

  return (
    <div>
      <h1 className="text-3xl font-bold">Comunidade</h1>
      <p className="mt-1 text-muted">
        O que a galera anda vendo. O que você marca como Já vi também aparece aqui, e você escolhe quem vê, em{" "}
        <Link to="/conta#quem-ve" className="underline hover:text-accent">
          Minha conta
        </Link>
        .
      </p>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="De quem ver os registros">
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
            className={`chip cursor-pointer px-4 py-1.5 text-sm ${onlyFollowing === only ? "border-accent text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {onlyFollowing && entries?.length === 0 && !hasMore && (
        <p className="mt-8 text-muted">
          {people.length === 0
            ? "Você ainda não segue ninguém. Abra o perfil de alguém pelo nome num registro e toque em Seguir."
            : "Quem você segue ainda não registrou nada."}
        </p>
      )}
      {!onlyFollowing && entries?.length === 0 && !hasMore && (
        <p className="mt-8 text-muted">
          Ainda não tem nada por aqui. Marque "Já vi" no{" "}
          <Link to="/para-voce" className="text-accent underline">feed</Link> e seja a primeira pessoa!
        </p>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div>
          {entries && entries.length > 0 && (
            <h2 className="border-b border-line/60 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">
              Registros recentes
            </h2>
          )}
          {/* Em telas largas, a timeline vira duas colunas, para usar a largura toda sem linhas longas demais */}
          <div className="grid xl:grid-cols-2 xl:gap-x-12">
            {entries?.map((e, position) => (
              <Post key={e.id} entry={e} position={position} />
            ))}
          </div>
          <div ref={bottom} />
        </div>
        <div className="order-first flex flex-col gap-8 lg:order-none">
          <Following people={people} />
          <Suggestions
            people={suggested}
            onFollow={(p) => {
              setSuggested((all) => all.filter((x) => x.id !== p.id));
              setPeople((all) => [...all, { id: p.id, name: p.name }].sort((a, b) => a.name.localeCompare(b.name)));
            }}
          />
          <Reviewers people={reviewers} />
        </div>
      </div>

      {loading && <HandNote className="mt-8 text-center">Procurando o que a galera anda vendo...</HandNote>}
      {failed && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted">Não conseguimos carregar a Comunidade agora.</p>
          <button className="btn-ghost mt-3" onClick={loadMore}>
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}
