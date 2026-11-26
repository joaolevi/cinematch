import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import DiaryTable, { monthLabel } from "../components/DiaryTable";
import MediaCard from "../components/MediaCard";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import QuickRate from "../components/QuickRate";
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
  type DiaryFilter,
  type Period,
} from "../taste";
import type { DiaryEntry } from "../types";
import { DIARY_GRID, TAPE_COLORS, tabColor } from "../ui";
import { usePageTitle } from "../usePageTitle";

const RANKING_SIZE = 10;
const FOLDED_START = 8; // quantos títulos de um grupo sem data aparecem antes de "Ver os N títulos"
const LOVED_FROM = 3.5;
const HATED_BELOW = 3; // quem só dá notas altas não vê títulos bons na lista dos que odiou
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
              <Polaroid position={position} caption={`nº ${position + 1}`} album={e.media.type === "album"}>
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
  // Série que a pessoa ainda está vendo (RFF24)
  if (entry.status === "watching") return entry.season ? `assistindo · T${entry.season}` : "assistindo";
  // No grupo "Sem data", repetir "sem data" em cada polaroide só faz barulho
  if (!entry.consumed_at) return entry.from_onboarding ? "favorito ♥" : "";
  return new Date(`${entry.consumed_at}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}


/** Uma linha com os números do diário, embaixo do título. A frase do gosto e os post-its ficam no perfil. */
function Summary({ entries }: { entries: DiaryEntry[] }) {
  const { user } = useAuth();
  const notes = useMemo(() => notesOf(entries), [entries]);
  return (
    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
      {notes.slice(0, 3).map((note) => (
        <span key={note.label}>
          <strong className="font-display text-lg text-cream">{note.value}</strong> {note.label}
        </span>
      ))}
      <Link to={`/pessoas/${user?.id}`} className="font-semibold text-accent hover:underline">
        Ver meu perfil →
      </Link>
    </p>
  );
}

/** "A história do meu gosto": o diário de quem está logado, escrito na primeira pessoa. */
export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("always");
  const [filter, setFilter] = useState<DiaryFilter | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set()); // os grupos sem data que a pessoa abriu
  // Polaroides (o caderno) ou tabela (como o diário do Letterboxd). A escolha fica neste navegador
  const [view, setViewState] = useState<"fotos" | "tabela">(() => {
    try {
      return localStorage.getItem("tastory.diario.visao") === "tabela" ? "tabela" : "fotos";
    } catch {
      return "fotos";
    }
  });
  const setView = (v: "fotos" | "tabela") => {
    setViewState(v);
    try {
      localStorage.setItem("tastory.diario.visao", v);
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  };
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
      {!!entries?.length && <Summary entries={entries} />}

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
              ["gosto", "Em números"],
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
            <Link to="/meu-gosto" className="btn-ghost ml-auto px-4 py-1.5 text-sm">
              Corrigir meu gosto
            </Link>
            <Link to="/retrospectiva" className="btn-ghost px-4 py-1.5 text-sm">
              Ver minha retrospectiva
            </Link>
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
        <div className="mt-6 flex justify-end">
          <div role="group" aria-label="Como ver o diário" className="inline-flex rounded-full border border-line bg-bg/40 p-0.5">
            {(
              [
                ["fotos", "Polaroides"],
                ["tabela", "Tabela"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={`cursor-pointer rounded-full px-3 py-0.5 text-sm transition ${
                  view === key ? "bg-accent font-bold text-bg" : "text-stone-300 hover:text-cream"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {view === "tabela" && <DiaryTable groups={groups} onEdit={setEditing} />}
        <div className={`mt-4 space-y-10 ${view === "tabela" ? "hidden" : ""}`}>
          {groups.map(([label, list]) => {
            // Os grupos sem data (os favoritos do começo e o que foi registrado sem dia) não contam uma história no
            // tempo e costumam ser grandes: ficam recolhidos, com o botão para abrir
            const foldable = label === "Meus primeiros favoritos" || label === "Sem data";
            const folded = foldable && !openGroups.has(label) && list.length > FOLDED_START;
            return (
            <section key={label}>
              <h2 className="inline-block rounded-t-xl border border-b-0 border-line/60 bg-surface px-4 py-1.5 text-sm font-bold text-accent">
                {label} <span className="ml-1 text-xs font-normal text-muted">{list.length}</span>
              </h2>
              <div className={`${DIARY_GRID} border-t border-line/60 pt-6`}>
                {(folded ? list.slice(0, FOLDED_START) : list).map((e, position) => (
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
                      {e.rating != null ? (
                        <StarsDisplay value={e.rating} size={13} />
                      ) : (
                        <QuickRate entryId={e.id} title={e.media.title} size={16} />
                      )}
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
              {folded && (
                <button className="btn-ghost mt-4 px-4 py-1.5 text-sm" onClick={() => setOpenGroups(new Set(openGroups).add(label))}>
                  Ver os {list.length} títulos
                </button>
              )}
            </section>
            );
          })}
        </div>
      </div>

      {editing && (
        <SeenModal
          media={editing.media}
          initialRating={editing.rating}
          initialReview={editing.review ?? ""}
          initialDate={editing.consumed_at}
          initialSpoiler={editing.spoiler ?? false}
          withSpoiler
          onClose={() => setEditing(null)}
          onConfirm={async (rating, review, date, spoiler) => {
            await api.updateDiary(editing.id, { rating, review, consumed_at: date, spoiler });
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
