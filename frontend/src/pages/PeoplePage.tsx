import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import CommunityNav from "../components/CommunityNav";
import HandNote from "../components/HandNote";
import { PersonResult, usePeople } from "../components/PeopleSearch";
import { Avatar } from "../components/WatchedBy";
import { plural } from "../format";
import type { Member } from "../types";
import { usePageTitle } from "../usePageTitle";

type Period = "semana" | "mes" | "sempre";
const PERIODS: [Period, string][] = [
  ["semana", "Esta semana"],
  ["mes", "Este mês"],
  ["sempre", "Desde sempre"],
];

/** O botão de seguir de cada pessoa, que vira "Seguindo" e desfaz com outro clique. */
function FollowButton({ person }: { person: Member }) {
  const [following, setFollowing] = useState(person.following);
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`shrink-0 px-3 py-1 text-xs ${following ? "btn-ghost" : "btn-primary"}`}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? `Deixar de seguir ${person.name}` : `Seguir ${person.name}`}
      onClick={async () => {
        setBusy(true);
        try {
          await (following ? api.unfollow(person.id) : api.follow(person.id));
          setFollowing(!following);
        } finally {
          setBusy(false);
        }
      }}
    >
      {following ? "Seguindo" : "Seguir"}
    </button>
  );
}

/**
 * Pessoas, como a página de membros do Letterboxd: em destaque, as mais ativas no período, com os últimos pôsteres; e,
 * embaixo, a lista com os números de cada uma (títulos, resenhas, curtidas e seguidores) e o botão de seguir.
 */
export default function PeoplePage() {
  usePageTitle("Pessoas");
  const [period, setPeriod] = useState<Period>("semana");
  const [people, setPeople] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const found = usePeople(q);

  useEffect(() => {
    setPeople(null);
    api.popularPeople(period).then(setPeople).catch((e) => setError((e as Error).message));
  }, [period]);

  const featured = (people ?? []).filter((p) => (p.active ?? 0) > 0).slice(0, 5);
  return (
    <div>
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold">Comunidade</h1>
        <p className="mt-1 text-muted">Quem anda registrando, escrevendo e curtindo.</p>
        <CommunityNav />
      </header>

      <div className="mx-auto mt-8 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="De quando" className="inline-flex rounded-full border border-line bg-bg/40 p-0.5">
            {PERIODS.map(([key, label]) => (
              <button
                key={key}
                aria-pressed={period === key}
                onClick={() => setPeriod(key)}
                className={`cursor-pointer rounded-full px-3 py-1 text-sm transition ${
                  period === key ? "bg-accent font-bold text-bg" : "text-stone-300 hover:text-cream"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <label htmlFor="buscar-pessoas" className="sr-only">
              Procurar pessoas pelo nome
            </label>
            <input
              id="buscar-pessoas"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar pessoas pelo nome"
              autoComplete="off"
              className="input w-full py-2 text-sm"
            />
            {found && (
              <div role="status" className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-surface p-1 shadow-xl">
                {found.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted">Ninguém com esse nome.</p>
                ) : (
                  <ul>
                    {found.map((p) => (
                      <li key={p.id}>
                        <PersonResult person={p} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p className="mt-6 text-red-300">{error}</p>}
        {people === null && !error && <HandNote className="mt-6">Procurando quem anda ativo...</HandNote>}

        {/* Em destaque: a foto grande, o nome e os três últimos pôsteres, como os membros populares do Letterboxd */}
        {featured.length > 0 && (
          <section aria-labelledby="destaque" className="mt-10">
            <h2 id="destaque" className="font-hand text-2xl font-bold text-accent">
              {period === "semana" ? "Mais ativas na semana" : period === "mes" ? "Mais ativas no mês" : "Mais ativas"}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
              {featured.map((p) => (
                <li key={p.id} className="text-center">
                  <Link to={`/pessoas/${p.id}`} className="group block">
                    <span className="mx-auto block w-fit rounded-full ring-2 ring-transparent transition group-hover:ring-accent">
                      <Avatar name={p.name} userId={p.id} size="h-24 w-24 text-3xl" />
                    </span>
                    <span className="mt-3 block font-semibold group-hover:text-accent">{p.name}</span>
                  </Link>
                  <p className="text-xs text-muted">{plural(p.active ?? 0, "registro", "registros")}</p>
                  {p.recent.length > 0 && (
                    <div aria-hidden className="mt-2 flex justify-center gap-1">
                      {p.recent.map((m) =>
                        m.poster_url ? (
                          <img
                            key={m.id}
                            src={m.poster_url}
                            alt=""
                            loading="lazy"
                            className={`w-9 rounded-sm object-cover shadow ${m.type === "album" ? "aspect-square self-end" : "aspect-[2/3]"}`}
                          />
                        ) : null,
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* A lista, com os números de cada pessoa */}
        {people && people.length > 0 && (
          <section aria-labelledby="todas" className="mt-12">
            <h2 id="todas" className="font-hand text-2xl font-bold text-accent">
              Todas as pessoas
            </h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-line/60 text-left text-xs tracking-wider text-muted uppercase">
                  <th className="py-2 font-semibold">Pessoa</th>
                  <th className="hidden py-2 text-right font-semibold sm:table-cell">Títulos</th>
                  <th className="hidden py-2 text-right font-semibold md:table-cell">Resenhas</th>
                  <th className="hidden py-2 text-right font-semibold md:table-cell">Curtidas</th>
                  <th className="py-2 text-right font-semibold">Seguidores</th>
                  <th className="py-2">
                    <span className="sr-only">Seguir</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {people.map((p) => (
                  <tr key={p.id} className="hover:bg-surface/60">
                    <td className="py-3 pr-3">
                      <Link to={`/pessoas/${p.id}`} className="flex items-center gap-3 font-semibold hover:text-accent">
                        <Avatar name={p.name} userId={p.id} size="h-10 w-10" />
                        <span className="min-w-0 truncate">{p.name}</span>
                      </Link>
                    </td>
                    <td className="hidden py-3 pr-3 text-right tabular-nums sm:table-cell">{p.titles ?? "–"}</td>
                    <td className="hidden py-3 pr-3 text-right tabular-nums md:table-cell">{p.reviews ?? "–"}</td>
                    <td className="hidden py-3 pr-3 text-right tabular-nums md:table-cell">{p.likes}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{p.followers}</td>
                    <td className="py-3 text-right">
                      <FollowButton person={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {people.some((p) => p.titles == null) && (
              <p className="mt-3 text-xs text-muted">“–”: a pessoa só mostra o diário para quem segue.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
