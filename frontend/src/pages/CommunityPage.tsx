import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Poster from "../components/Poster";
import WatchedBy, { Avatar } from "../components/WatchedBy";
import { plural } from "../format";
import type { CommunityEntry, Reviewer } from "../types";

const PAGE = 20;

function Post({ entry }: { entry: CommunityEntry }) {
  const link = `/media/${entry.media.id}`;
  return (
    <article className="flex gap-4 py-5">
      <Link to={link} className="w-16 shrink-0 sm:w-20" aria-label={entry.media.title}>
        <Poster media={entry.media} compact />
      </Link>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg leading-snug font-bold">
          <Link to={link} className="hover:text-accent">
            {entry.media.title}
          </Link>{" "}
          {entry.media.year && <span className="font-normal text-muted">{entry.media.year}</span>}
        </h2>
        <div className="mt-1.5">
          <WatchedBy
            name={entry.user_name}
            rating={entry.rating}
            consumedAt={entry.consumed_at}
            createdAt={entry.created_at}
          />
        </div>
        {entry.review && <p className="mt-2 break-words whitespace-pre-line text-slate-200">{entry.review}</p>}
      </div>
    </article>
  );
}

function Reviewers({ people }: { people: Reviewer[] }) {
  if (people.length === 0) return null;
  return (
    <aside className="order-first lg:order-none">
      <h2 className="border-b border-line/60 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">
        Quem mais escreve
      </h2>
      <ul className="flex flex-wrap gap-x-6 lg:block lg:divide-y lg:divide-line/60">
        {people.map((person, position) => (
          <li key={position} className="flex items-center gap-3 py-3">
            <Avatar name={person.name} size="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{person.name}</p>
              <p className="text-xs text-muted">
                {plural(person.titles, "título", "títulos")}, {plural(person.reviews, "resenha", "resenhas")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Comunidade: o que as pessoas andam vendo. No MVP, todo mundo vê todo mundo. */
export default function CommunityPage() {
  const [entries, setEntries] = useState<CommunityEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const fetching = useRef(false);

  useEffect(() => {
    api.reviewers().then(setReviewers).catch(() => {});
  }, []);

  const loadMore = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const loaded = entries ?? [];
      const page = await api.community(PAGE, loaded.at(-1)?.id);
      setEntries([...loaded, ...page.items]);
      setHasMore(page.items.length === PAGE);
    } catch {
      setFailed(true);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [entries]);

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
        O que a galera anda vendo. O que você marca como Já vi também aparece aqui, para quem tem conta.
      </p>

      {entries?.length === 0 && !hasMore && (
        <p className="mt-8 text-muted">
          Ainda não tem nada por aqui. Marque "Já vi" no{" "}
          <Link to="/" className="text-accent underline">feed</Link> e seja a primeira pessoa!
        </p>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
        <div>
          {entries && entries.length > 0 && (
            <h2 className="border-b border-line/60 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">
              Registros recentes
            </h2>
          )}
          <div className="divide-y divide-line/60">
            {entries?.map((e) => (
              <Post key={e.id} entry={e} />
            ))}
          </div>
          <div ref={bottom} />
        </div>
        <Reviewers people={reviewers} />
      </div>

      {loading && <p className="mt-8 text-center text-sm text-muted">Procurando o que a galera anda vendo...</p>}
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
