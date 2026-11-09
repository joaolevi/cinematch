import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import MediaCard from "../components/MediaCard";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import SeenModal from "../components/SeenModal";
import { StarsDisplay } from "../components/Stars";
import TasteChartsView from "../components/TasteCharts";
import { MEDIA_STYLE, plural } from "../format";
import { diaryChanged, useDiaryVersion } from "../seen";
import {
  inPeriod,
  matches,
  MIN_ENTRIES_FOR_TASTE,
  notesOf,
  PERIODS,
  tasteCharts,
  tasteOf,
  type DiaryFilter,
  type Period,
} from "../taste";
import type { DiaryEntry } from "../types";
import { MEDIA_GRID, TAPE_COLORS, tabColor } from "../ui";
import { usePageTitle } from "../usePageTitle";

const RANKING_SIZE = 10;
const LOVED_FROM = 3.5;
const HATED_BELOW = 3; // quem só dá notas altas não vê títulos bons na lista dos que odiou
const NOTE_TILT = [-3, 2, -1.5, 2.5, -2, 1.5];
const INK = "text-[#2b211c]";
const RED_INK = "text-[#b9452f]";

function Ranking({ title, entries, color }: { title: string; entries: DiaryEntry[]; color: string }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className={`font-display text-xl font-bold ${color}`}>{title}</h2>
      <ol className="mt-5 flex gap-5 overflow-x-auto px-1 pt-2 pb-3 md:grid md:grid-cols-5 md:overflow-visible xl:grid-cols-10">
        {entries.map((e, position) => (
          <li key={e.id} className="group w-28 shrink-0 md:w-auto">
            <Link to={`/media/${e.media.id}`} className="block" title={e.media.title}>
              <Polaroid position={position} caption={`nº ${position + 1}`}>
                <Poster media={e.media} compact rounded="rounded-[2px]" />
              </Polaroid>
            </Link>
            <p className="mt-2 truncate text-center text-xs font-semibold">{e.media.title}</p>
            <div className="mt-0.5 flex justify-center">
              <StarsDisplay value={e.rating} size={13} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Legenda da polaroide, como se fosse escrita à mão: "3 de nov." */
function caption(entry: DiaryEntry): string {
  if (!entry.consumed_at) return entry.from_onboarding ? "favorito ♥" : "sem data";
  return new Date(`${entry.consumed_at}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function monthLabel(entry: DiaryEntry): string {
  if (!entry.consumed_at) return entry.from_onboarding ? "Meus primeiros favoritos" : "Sem data";
  const label = new Date(`${entry.consumed_at}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1); // "Novembro de 2026"
}

/** Topo do diário: uma folha pautada com a frase do gosto e os números em post-its. */
function TastePage({ entries }: { entries: DiaryEntry[] }) {
  const taste = useMemo(() => tasteOf(entries), [entries]);
  const notes = useMemo(() => notesOf(entries), [entries]);
  return (
    <section className="paper relative mt-8 -rotate-[0.3deg] rounded-sm py-7 pr-6 pl-14 sm:pr-8 sm:pl-16">
      <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
      <span aria-hidden className="tape -top-2.5 right-16 rotate-3" style={{ background: TAPE_COLORS[2] }} />
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className={INK}>
          {taste ? (
            <>
              <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Meu gosto em uma frase:</p>
              <p className="mt-1 max-w-3xl font-display text-3xl leading-tight font-bold sm:text-4xl">
                Sou do time <mark className="marker">{taste.highlight}</mark>
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
            </>
          ) : (
            <>
              <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Querido diário,</p>
              <p className="mt-1 font-display text-3xl leading-tight font-bold">Estou só começando.</p>
              <p className="mt-3 font-hand text-2xl leading-8 font-semibold opacity-85">
                Com {MIN_ENTRIES_FOR_TASTE} títulos, eu descubro aqui o meu gosto em uma frase.
              </p>
            </>
          )}
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:gap-4 lg:w-[27rem]">
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
      </div>
    </section>
  );
}

/** "A história do meu gosto": o diário de quem está logado, escrito na primeira pessoa. */
export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("always");
  const [filter, setFilter] = useState<DiaryFilter | null>(null);
  const [params, setParams] = useSearchParams();
  const tabs = useRef<HTMLDivElement>(null);
  const tab = params.get("aba") === "gosto" ? "gosto" : "linha";
  usePageTitle(tab === "gosto" ? "Meu gosto" : "Meu diário");

  const load = () =>
    api
      .diary()
      .then(setEntries)
      .catch((e) => setError(e.message));

  // Recarrega quando o diário muda em qualquer tela, inclusive pelo botão Registrar
  const version = useDiaryVersion();
  useEffect(() => {
    load();
  }, [version]);

  const [filterPeriod, setFilterPeriod] = useState<Period>("always"); // o período do gráfico em que a pessoa clicou
  const shown = useMemo(
    () => (filter ? inPeriod(entries ?? [], filterPeriod).filter((e) => matches(e, filter)) : (entries ?? [])),
    [entries, filter, filterPeriod],
  );
  const groups = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    for (const e of shown) map.set(monthLabel(e), [...(map.get(monthLabel(e)) ?? []), e]);
    return [...map.entries()];
  }, [shown]);

  const periodEntries = useMemo(() => inPeriod(entries ?? [], period), [entries, period]);
  const charts = useMemo(() => tasteCharts(periodEntries), [periodEntries]);
  const rankings = useMemo(() => {
    const rated = periodEntries.filter((e) => e.rating != null);
    const note = (e: DiaryEntry) => e.rating ?? 0;
    return {
      loved: rated
        .filter((e) => note(e) >= LOVED_FROM)
        .sort((a, b) => note(b) - note(a))
        .slice(0, RANKING_SIZE),
      hated: rated
        .filter((e) => note(e) < HATED_BELOW)
        .sort((a, b) => note(a) - note(b))
        .slice(0, RANKING_SIZE),
    };
  }, [periodEntries]);

  function openTab(key: "linha" | "gosto") {
    setParams(key === "gosto" ? { aba: "gosto" } : {}, { replace: true });
  }

  /** Clicar em um gráfico mostra esses títulos na linha do tempo. */
  function pick(f: DiaryFilter) {
    setFilter(f);
    setFilterPeriod(period);
    openTab("linha");
    tabs.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Meu diário</h1>
      <p className="font-hand text-2xl font-bold text-accent">a história do meu gosto</p>

      {error && <p className="mt-6 text-red-300">{error}</p>}
      {entries?.length === 0 && (
        <section className={`paper relative mt-8 max-w-3xl -rotate-[0.3deg] rounded-sm py-7 pr-6 pl-14 ${INK}`}>
          <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
          <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Querido diário,</p>
          <p className="font-display text-3xl leading-tight font-bold">ainda não registrei nada.</p>
          <p className="mt-2 font-hand text-2xl leading-8 font-semibold opacity-85">
            Minha história começa quando eu marcar Já vi no{" "}
            <Link to="/para-voce" className="underline">
              feed
            </Link>{" "}
            ou usar o + Registrar, lá em cima.
          </p>
        </section>
      )}
      {!!entries?.length && <TastePage entries={entries} />}

      {!!entries?.length && (
        <div
          ref={tabs}
          role="tablist"
          aria-label="O que ver no diário"
          className="mt-10 flex scroll-mt-28 gap-1 border-b border-line"
        >
          {(
            [
              ["linha", "Linha do tempo"],
              ["gosto", "Meu gosto"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => openTab(key)}
              className="nb-tab"
              style={tabColor(key === "linha" ? 0 : 2)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "gosto" && !!entries?.length && (
        <div role="tabpanel" className="mt-6">
          <div className="flex flex-wrap items-center gap-2" aria-label="Período">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={`chip cursor-pointer px-4 py-1.5 text-sm ${period === p.key ? "border-accent text-accent" : ""}`}
              >
                {p.label}
              </button>
            ))}
            <span className="ml-1 text-xs text-muted">Toque numa barra para ver esses títulos na linha do tempo.</span>
          </div>

          {periodEntries.length === 0 ? (
            <p className="mt-8 font-hand text-2xl text-stone-300">Não registrei nada nesse período.</p>
          ) : (
            <>
              <Ranking title="Top 10 que eu mais amei" entries={rankings.loved} color="text-amber" />
              <Ranking title="Top 10 que eu mais odiei" entries={rankings.hated} color="text-coral" />
              {periodEntries.length < MIN_ENTRIES_FOR_TASTE ? (
                <p className="mt-8 text-muted">
                  Com {MIN_ENTRIES_FOR_TASTE} títulos no período, os gráficos aparecem aqui.
                </p>
              ) : (
                <div className="mt-10">
                  <TasteChartsView data={charts} onPick={pick} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className={tab === "linha" ? "" : "hidden"} role="tabpanel">
        {filter && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
            <span>
              Mostrando <strong className="text-accent">
                {filter.label}
                {filterPeriod !== "always" && `, ${PERIODS.find((p) => p.key === filterPeriod)?.label.toLowerCase()}`}
              </strong>:{" "}
              {plural(shown.length, "título", "títulos")}
            </span>
            <button className="cursor-pointer font-bold text-accent hover:underline" onClick={() => setFilter(null)}>
              Ver tudo
            </button>
          </div>
        )}
        <div className="mt-8 space-y-10">
          {groups.map(([label, list]) => (
            <section key={label}>
              <h2 className="inline-block rounded-t-xl border border-b-0 border-line/60 bg-surface px-4 py-1.5 text-sm font-bold text-accent">
                {label}
              </h2>
              <div className={`${MEDIA_GRID} border-t border-line/60 pt-6`}>
                {list.map((e, position) => (
                  <MediaCard
                    key={e.id}
                    media={e.media}
                    polaroid={{ caption: caption(e), position }}
                    subtitle={`${MEDIA_STYLE[e.media.type].label}${e.media.year ? ` de ${e.media.year}` : ""}`}
                    overlay={
                      <button
                        onClick={() => setEditing(e)}
                        aria-label={`Editar o registro de ${e.media.title}`}
                        title="Editar registro"
                        className="absolute top-3 left-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-bg/80 text-cream shadow-md backdrop-blur-sm transition hover:bg-accent hover:text-bg"
                      >
                        <svg
                          viewBox="0 0 16 16"
                          aria-hidden
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        >
                          <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" />
                        </svg>
                      </button>
                    }
                  >
                    <div className="mt-1">
                      <StarsDisplay value={e.rating} size={13} />
                    </div>
                    {e.review && (
                      <p className="ruled mt-1 line-clamp-2 font-hand text-lg text-stone-200" title={e.review}>
                        {e.review_hidden && <span className="mr-1 text-red-300">[oculta pela moderação]</span>}
                        {e.review}
                      </p>
                    )}
                  </MediaCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {editing && (
        <SeenModal
          media={editing.media}
          initialRating={editing.rating}
          initialReview={editing.review ?? ""}
          initialDate={editing.consumed_at}
          onClose={() => setEditing(null)}
          onConfirm={async (rating, review, date) => {
            await api.updateDiary(editing.id, { rating, review, consumed_at: date });
            setEditing(null);
            diaryChanged();
          }}
          onDelete={async () => {
            await api.deleteDiary(editing.id);
            setEditing(null);
            diaryChanged();
          }}
        />
      )}
    </div>
  );
}
