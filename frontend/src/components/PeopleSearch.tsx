import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { plural } from "../format";
import type { FoundPerson } from "../types";
import { Avatar } from "./WatchedBy";

/** Uma linha de resultado: a foto, o nome e os números da pessoa, que abrem o perfil dela. */
export function PersonResult({ person }: { person: FoundPerson }) {
  const facts = [
    person.titles != null && plural(person.titles, "título", "títulos"),
    plural(person.followers, "seguidor", "seguidores"),
  ].filter(Boolean);
  return (
    <Link to={`/pessoas/${person.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
      <Avatar name={person.name} userId={person.id} size="h-9 w-9" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{person.name}</span>
        <span className="block text-xs text-muted">
          {facts.join(" · ")}
          {person.following && <span className="text-accent"> · você segue</span>}
        </span>
      </span>
    </Link>
  );
}

/** As pessoas com esse nome, enquanto a pessoa digita. Vazio: nada. */
export function usePeople(q: string): FoundPerson[] | null {
  const [found, setFound] = useState<FoundPerson[] | null>(null);
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setFound(null);
      return;
    }
    const t = setTimeout(() => api.searchPeople(text).then(setFound).catch(() => setFound([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  return found;
}

/** Procurar pessoas pelo nome, com os resultados logo abaixo. */
export default function PeopleSearch() {
  const id = useId();
  const [q, setQ] = useState("");
  const found = usePeople(q);
  return (
    <section aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="border-b border-line/60 pb-1 font-hand text-2xl leading-8 font-bold text-accent">
        Procurar pessoas
      </h2>
      <label htmlFor={`${id}-campo`} className="sr-only">
        Nome da pessoa
      </label>
      <input
        id={`${id}-campo`}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nome de alguém"
        autoComplete="off"
        className="input mt-3 w-full py-2 text-sm"
      />
      {found && (
        <div role="status" className="mt-2">
          {found.length === 0 ? (
            <p className="px-2 text-sm text-muted">Ninguém com esse nome.</p>
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
    </section>
  );
}
