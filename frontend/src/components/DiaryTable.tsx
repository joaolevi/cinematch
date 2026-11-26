import { Link } from "react-router-dom";
import { MEDIA_STYLE } from "../format";
import type { DiaryEntry } from "../types";
import Poster from "./Poster";
import { StarsDisplay } from "./Stars";

/** O nome do grupo de cada registro: "Novembro de 2026", "Sem data" ou "Meus primeiros favoritos". */
export function monthLabel(entry: DiaryEntry): string {
  if (!entry.consumed_at) return entry.from_onboarding ? "Meus primeiros favoritos" : "Sem data";
  const label = new Date(`${entry.consumed_at}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1); // "Novembro de 2026"
}

/** Os registros agrupados por mês, na ordem em que vieram. */
export function groupByMonth(entries: DiaryEntry[]): [string, DiaryEntry[]][] {
  const map = new Map<string, DiaryEntry[]>();
  for (const e of entries) map.set(monthLabel(e), [...(map.get(monthLabel(e)) ?? []), e]);
  return [...map.entries()];
}

/**
 * O diário em tabela, como o do Letterboxd: um mês por bloco e, em cada linha, o dia, o título com o pôster pequeno, o
 * tipo, a nota, se tem resenha e o botão de editar. Mais compacto que as polaroides, bom para diários grandes.
 */
export default function DiaryTable({ groups, onEdit }: { groups: [string, DiaryEntry[]][]; onEdit?: (e: DiaryEntry) => void }) {
  return (
    <div className="mt-4 space-y-8">
      {groups.map(([label, list]) => (
        <section key={label} aria-label={label}>
          <h2 className="font-hand text-2xl font-bold text-accent">{label}</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>Dia</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Nota</th>
                <th>Resenha</th>
                <th>Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 border-y border-line/60">
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-surface/60">
                  <td className="w-14 py-2 pr-2 text-center align-middle">
                    {e.consumed_at ? (
                      <span className="font-display text-2xl font-bold">{Number(e.consumed_at.slice(8, 10))}</span>
                    ) : (
                      <span className="text-xs text-muted">{e.status === "watching" ? "▶" : "–"}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Link to={`/media/${e.media.id}`} className="flex items-center gap-3 hover:text-accent">
                      <span className="w-9 shrink-0">
                        {e.media.poster_url ? (
                          <img
                            src={e.media.poster_url}
                            alt=""
                            loading="lazy"
                            className={`w-full rounded-sm object-cover shadow ${e.media.type === "album" ? "aspect-square" : "aspect-[2/3]"}`}
                          />
                        ) : (
                          <Poster media={e.media} compact rounded="rounded-sm" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{e.media.title}</span>
                        <span className="block text-xs text-muted">
                          {e.media.year}
                          {e.status === "watching" && ` · assistindo${e.season ? ` · T${e.season}` : ""}`}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden py-2 pr-3 text-xs font-bold sm:table-cell" style={{ color: MEDIA_STYLE[e.media.type].color }}>
                    {MEDIA_STYLE[e.media.type].label}
                  </td>
                  <td className="py-2 pr-3">{e.rating != null ? <StarsDisplay value={e.rating} size={13} /> : <span className="text-xs text-muted">sem nota</span>}</td>
                  <td className="hidden py-2 pr-3 md:table-cell">
                    {e.review ? (
                      <span title={e.review} className="text-muted">
                        <span aria-hidden>✎</span>
                        <span className="sr-only">Tem resenha: {e.review}</span>
                      </span>
                    ) : null}
                  </td>
                  <td className="w-10 py-2 text-right">
                    {onEdit && (
                    <button
                      onClick={() => onEdit(e)}
                      aria-label={`Editar o registro de ${e.media.title}`}
                      title="Editar registro"
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-accent"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                        <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" />
                      </svg>
                    </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
