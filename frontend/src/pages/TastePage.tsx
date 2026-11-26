import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import HandNote from "../components/HandNote";
import Poster from "../components/Poster";
import { formatRating } from "../format";
import { diaryChanged } from "../seen";
import type { TasteFacet, TasteProfile } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

const MORE = 1.5;
const LESS = 0.5;
const OFF = 0;

function stateOf(weight: number): string | null {
  if (weight === 0) return "fora das sugestões";
  if (weight > 1) return "pedindo mais";
  if (weight < 1) return "pedindo menos";
  return null;
}

const SHOWN = 5; // cada grupo mostra os que mais pesam; o resto fica atrás de "Ver todos"

function Section({ title, note, children }: { title: string; note: string; children: ReactNode[] }) {
  const [all, setAll] = useState(false);
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="text-xs text-muted">{note}</p>
      <ul className="mt-3 space-y-2">{all ? children : children.slice(0, SHOWN)}</ul>
      {children.length > SHOWN && (
        <button className="mt-3 text-xs font-semibold text-muted underline hover:text-accent" onClick={() => setAll(!all)}>
          {all ? "Mostrar só os principais" : `Ver todos (${children.length})`}
        </button>
      )}
    </section>
  );
}

/** Uma linha: o nome, quanto pesa no gosto e os botões de mais, menos e tirar. */
function FacetRow({
  facet,
  top,
  onSet,
  busy,
}: {
  facet: TasteFacet;
  top: number; // a maior fatia do grupo, para a barra ser proporcional a ela
  onSet: (weight: number) => void;
  busy: boolean;
}) {
  const state = stateOf(facet.weight);
  const toggle = (weight: number) => onSet(facet.weight === weight ? 1 : weight);
  const button = (weight: number, label: string, title: string) => (
    <button
      type="button"
      disabled={busy}
      aria-pressed={facet.weight === weight}
      title={title}
      onClick={() => toggle(weight)}
      className={`chip cursor-pointer px-2.5 py-0.5 text-xs ${facet.weight === weight ? "border-accent bg-accent/15 text-accent" : ""}`}
    >
      {label}
    </button>
  );
  return (
    // No celular, os botões descem para uma segunda linha: o nome e a barra ficam com a largura toda
    // No computador, os botões aparecem só na linha em que o mouse ou o foco está (ou quando já há um ajuste):
    // 60 botões de uma vez deixavam a tela carregada. No celular, que não tem mouse, eles ficam sempre à mostra
    <li className="group/facet grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-x-3 gap-y-1.5 rounded-md text-sm sm:grid-cols-[minmax(0,8rem)_1fr_auto] sm:hover:bg-surface-2/60">
      <span className="truncate" title={facet.label}>
        {facet.label}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
          <span className="bar-grow block h-full rounded-full bg-accent" style={{ width: `${Math.max((facet.share / (top || 1)) * 100, 2)}%` }} />
        </span>
        <span className="w-20 text-xs text-muted sm:w-24">{state ?? `${Math.round(facet.share * 100)}%`}</span>
      </span>
      <span
        className={`col-span-2 flex gap-1 transition-opacity sm:col-span-1 ${
          state ? "" : "sm:opacity-0 sm:group-focus-within/facet:opacity-100 sm:group-hover/facet:opacity-100"
        }`}
        role="group"
        aria-label={`Ajustar ${facet.label}`}
      >
        {button(MORE, "Mais", `Pedir mais ${facet.label}`)}
        {button(LESS, "Menos", `Pedir menos ${facet.label}`)}
        {button(OFF, "Não sugerir", `Não sugerir ${facet.label}`)}
      </span>
    </li>
  );
}

function why(t: TasteProfile["titles"][number]): string {
  if (t.rating != null) return `nota ${formatRating(t.rating)}`;
  if (t.entry_id != null) return "registrado sem nota";
  return "na sua lista";
}

/** Ver e corrigir o próprio perfil de gosto (RFF07): o que o Tastory acha, com "mais", "menos" e o que não conta. */
export default function TastePage() {
  usePageTitle("O que o Tastory acha do meu gosto");
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.taste().then(setProfile).catch((e) => setError((e as Error).message));
  useEffect(() => {
    load();
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setFacet = (facet: TasteFacet) => (weight: number) => run(() => api.adjust(facet.kind, facet.value, weight));
  const exclude = (entryId: number, excluded: boolean) =>
    run(async () => {
      await api.updateDiary(entryId, { excluded });
      diaryChanged();
    });

  if (error) return <HandNote>{error}</HandNote>;
  if (!profile) return <HandNote>Lendo o seu gosto...</HandNote>;
  const empty = profile.titles.length === 0;

  return (
    <div>
      <h1 className="text-3xl font-bold">O que o Tastory acha do meu gosto</h1>
      <p className="font-hand text-2xl font-bold text-accent">e onde dá para corrigir</p>

      <section className="paper relative mt-6 max-w-3xl -rotate-[0.2deg] rounded-sm py-5 pr-6 pl-14 text-sm leading-6 text-[#2b211c]">
        <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[2] }} />
        <p>
          É assim que o recomendador enxerga você, a partir do que você registrou: cada título curtido espalha o peso dele
          pelos gêneros, climas, épocas e pessoas. Passe o mouse numa linha: <strong>Mais</strong> e <strong>Menos</strong> mudam as
          sugestões na hora; <strong>Não sugerir</strong> para de sugerir aquilo. Um registro marcado para não contar continua no diário, mas
          sai do cálculo.{" "}
          <Link to="/como-recomendamos" className="underline hover:text-[#b9452f]">
            Como recomendamos
          </Link>
        </p>
      </section>

      {empty ? (
        <HandNote className="mt-8">
          Ainda não há o que mostrar. Registre o que você viu ou ouviu, ou{" "}
          <Link to="/onboarding" className="underline">
            conte o que você curte
          </Link>
          .
        </HandNote>
      ) : (
        <>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Section title="Gêneros" note="Os gêneros dos filmes, séries e discos que você curtiu">
              {profile.genres.map((f) => (
                <FacetRow key={f.value} facet={f} top={profile.genres[0]?.share ?? 1} onSet={setFacet(f)} busy={busy} />
              ))}
            </Section>
            <Section title="Climas" note="O clima do que você curtiu: leve, tenso, melancólico...">
              {profile.moods.map((f) => (
                <FacetRow key={f.value} facet={f} top={profile.moods[0]?.share ?? 1} onSet={setFacet(f)} busy={busy} />
              ))}
            </Section>
            <Section title="Épocas" note="Quando saíram os títulos que você curtiu">
              {profile.decades.map((f) => (
                <FacetRow key={f.value} facet={f} top={profile.decades[0]?.share ?? 1} onSet={setFacet(f)} busy={busy} />
              ))}
            </Section>
            <Section title="Pessoas" note="Direção, criação e artistas do que você curtiu">
              {profile.people.map((f) => (
                <FacetRow key={f.value} facet={f} top={profile.people[0]?.share ?? 1} onSet={setFacet(f)} busy={busy} />
              ))}
            </Section>
          </div>

          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Os títulos que mais pesam</h2>
            <p className="mt-1 text-sm text-muted">Se algum não representa o seu gosto, tire do cálculo.</p>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {profile.titles.map((t) => (
                <li key={t.media.id} className="card flex min-w-0 items-center gap-3 p-3">
                  <Link to={`/media/${t.media.id}`} className="w-12 shrink-0" aria-label={t.media.title}>
                    <Poster media={t.media} compact rounded="rounded-[2px]" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" title={t.media.title}>
                      {t.media.title}
                    </p>
                    <p className="text-xs text-muted">
                      {why(t)}
                      {t.weight < 1 && " · pesando menos"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {t.entry_id != null && (
                        <button
                          className="cursor-pointer text-xs font-bold text-accent hover:underline"
                          disabled={busy}
                          onClick={() => exclude(t.entry_id!, true)}
                        >
                          Não contar no meu gosto
                        </button>
                      )}
                      {t.weight < 1 && (
                        <button
                          className="cursor-pointer text-xs font-bold text-accent hover:underline"
                          disabled={busy}
                          onClick={() => run(() => api.adjust("title", String(t.media.id), 1))}
                        >
                          Voltar ao peso normal
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {profile.excluded.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Fora do cálculo</h2>
          <p className="mt-1 text-sm text-muted">Continuam no seu diário, mas não mudam as sugestões.</p>
          <ul className="mt-3 space-y-2">
            {profile.excluded.map((e) => (
              <li key={e.entry_id} className="flex items-center gap-3 text-sm">
                <Link to={`/media/${e.media.id}`} className="font-semibold hover:text-accent">
                  {e.media.title}
                </Link>
                <button
                  className="cursor-pointer text-xs font-bold text-accent hover:underline"
                  disabled={busy}
                  onClick={() => exclude(e.entry_id, false)}
                >
                  Voltar a contar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.adjusted > 0 && (
        <p className="mt-10 text-sm">
          <button className="btn-ghost" disabled={busy} onClick={() => run(() => api.resetTaste())}>
            Desfazer todos os ajustes
          </button>
        </p>
      )}
    </div>
  );
}
