import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { HeartDoodle, SquiggleDoodle, StarDoodle } from "../components/Doodles";
import HandNote from "../components/HandNote";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import { formatRating } from "../format";
import { monthName, periodName, retroOf, retroPeriods, type RetroPeriod } from "../retro";
import { drawRetroCard } from "../retroCard";
import type { DiaryEntry } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

const INK = "text-[#2b211c]";
const RED_INK = "text-[#b9452f]";

/** Onde cada polaroide dos preferidos fica colada na página: espalhadas, inclinadas, umas por cima das outras. */
const COLLAGE: CSSProperties[] = [
  { left: "0%", top: "8%", rotate: "-6deg" },
  { left: "26%", top: "0%", rotate: "4deg" },
  { left: "52%", top: "10%", rotate: "-3deg" },
  { left: "14%", top: "44%", rotate: "5deg" },
  { left: "42%", top: "48%", rotate: "-7deg" },
];

/** O período da URL (?ano=2026&mes=11), ou o ano mais recente com registros datados. */
function periodFrom(params: URLSearchParams, years: { year: number; months: number[] }[]): RetroPeriod | null {
  const year = Number(params.get("ano")) || years[0]?.year;
  if (!year) return null;
  const month = Number(params.get("mes")) || null;
  return { year, month: month && month >= 1 && month <= 12 ? month : null };
}

/** Retrospectiva do gosto por mês e por ano, com um cartão para compartilhar (RFF05). Fica numa aba do Diário. */
export default function RetroPage({ embedded = false }: { embedded?: boolean }) {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    api.diary().then(setEntries).catch((e) => setError((e as Error).message));
  }, []);

  const years = useMemo(() => retroPeriods(entries ?? []), [entries]);
  const period = periodFrom(params, years);
  const undated = (entries ?? []).filter((e) => !e.consumed_at && !e.from_onboarding).length;
  const retro = useMemo(() => (entries && period ? retroOf(entries, period) : null), [entries, period?.year, period?.month]);
  usePageTitle(period ? `Retrospectiva de ${periodName(period)}` : "Retrospectiva");

  // O cartão é refeito a cada período; a prévia mostra exatamente a imagem que vai ser baixada
  useEffect(() => {
    if (!retro?.entries.length) return;
    let url = "";
    let cancelled = false;
    drawRetroCard(retro)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url });
      })
      .catch(() => setCard(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [retro]);

  // Troca o período sem perder o resto do endereço (no Diário, a aba fica em ?aba=retrospectiva)
  const choose = (p: RetroPeriod) => {
    const next = new URLSearchParams(params);
    next.set("ano", String(p.year));
    if (p.month) next.set("mes", String(p.month));
    else next.delete("mes");
    setParams(next, { replace: true });
  };

  if (error) return <HandNote>{error}</HandNote>;
  if (!entries) return <HandNote>Folheando o diário...</HandNote>;

  const fileName = period ? `retrospectiva-tastory-${period.year}${period.month ? `-${String(period.month).padStart(2, "0")}` : ""}.png` : "";
  const file = card ? new File([card.blob], fileName, { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  const months = years.find((y) => y.year === period?.year)?.months ?? [];
  const count = (type: string) => retro?.entries.filter((e) => e.media.type === type).length ?? 0;
  const stickers = (
    [
      [count("movie"), count("movie") === 1 ? "filme" : "filmes", "#8fb3c9"],
      [count("series"), count("series") === 1 ? "série" : "séries", "#c2a8e6"],
      [count("album"), count("album") === 1 ? "disco" : "discos", "#8fc09d"],
    ] as [number, string, string][]
  ).filter(([n]) => n > 0);

  return (
    <div>
      {!embedded && (
        <>
          <h1 className="text-3xl font-bold">Minha retrospectiva</h1>
          <p className="font-hand text-2xl font-bold text-accent">o meu gosto, mês a mês</p>
        </>
      )}

      {!period || !retro ? (
        <section className={`paper relative mt-8 max-w-3xl -rotate-[0.3deg] rounded-sm py-7 pr-6 pl-14 ${INK}`}>
          <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
          <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Querido diário,</p>
          <p className="font-display text-3xl leading-tight font-bold">ainda não tenho o que relembrar.</p>
          <p className="mt-2 font-hand text-2xl leading-8 font-semibold opacity-85">
            A retrospectiva junta o que eu vi e ouvi em cada mês. Ela começa quando eu registrar a data em que vi ou ouvi
            alguma coisa.
          </p>
        </section>
      ) : (
        <>
          <nav aria-label="Período da retrospectiva" className="mt-6 space-y-3">
            <div className={`flex flex-wrap gap-2 ${years.length < 2 ? "hidden" : ""}`}>
              {years.map(({ year }) => (
                <button
                  key={year}
                  onClick={() => choose({ year, month: null })}
                  aria-pressed={period.year === year}
                  className={`chip cursor-pointer px-4 py-1.5 text-sm ${period.year === year ? "border-accent text-accent" : ""}`}
                >
                  {year}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => choose({ year: period.year, month: null })}
                aria-pressed={period.month === null}
                className={`chip cursor-pointer px-3 py-1 text-sm ${period.month === null ? "border-accent text-accent" : ""}`}
              >
                O ano todo
              </button>
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => choose({ year: period.year, month: m })}
                  aria-pressed={period.month === m}
                  className={`chip cursor-pointer px-3 py-1 text-sm capitalize ${period.month === m ? "border-accent text-accent" : ""}`}
                >
                  {monthName(m)}
                </button>
              ))}
            </div>
          </nav>

          {retro.entries.length === 0 ? (
            <HandNote className="mt-8">Nada registrado com data em {periodName(period)}.</HandNote>
          ) : (
            <>
              <section className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
                {/* Uma página de caderno colada: o carimbo do tipo, a frase do gosto, adesivos com as contagens, fitas com os
                    gêneros, post-its com os números e as polaroides dos preferidos, com desenhos à mão em volta */}
                <div className={`paper relative overflow-hidden rounded-sm py-8 pr-6 pl-14 sm:pr-8 sm:pl-16 ${INK}`}>
                  <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
                  <StarDoodle className="absolute top-6 right-8 h-12 w-12 rotate-12 text-[#d9a13b]" />
                  <SquiggleDoodle className="absolute bottom-5 left-16 h-4 w-28 text-[#b9452f]/60" />

                  <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Em {periodName(period)}, eu fui:</p>
                      <p className="rise mt-1 inline-block -rotate-3 rounded-lg border-4 border-[#b9452f] px-4 py-1 font-display text-3xl font-bold text-[#b9452f] sm:text-4xl">
                        {retro.archetype.name}
                      </p>
                      <p className="mt-2 font-hand text-xl leading-7 font-semibold opacity-80">{retro.archetype.text}</p>

                      {retro.taste && (
                        <p className="mt-6 font-display text-2xl leading-tight font-bold sm:text-3xl">
                          Sou do time <mark className="marker marker-draw">{retro.taste.highlight}</mark>
                          {retro.taste.decade && (
                            <>
                              {" "}
                              dos{" "}
                              <mark className="marker marker-draw" style={{ "--marker": "rgb(232 115 90 / 0.5)" } as CSSProperties}>
                                {retro.taste.decade}
                              </mark>
                            </>
                          )}
                          .
                        </p>
                      )}

                      {/* As contagens viram adesivos redondos, nas cores de filme, série e disco */}
                      <ul className="mt-6 flex flex-wrap gap-3" aria-label="O que eu vi e ouvi">
                        {stickers.map(([n, label, color], i) => (
                          <li
                            key={label}
                            className="rise grid h-20 w-20 place-items-center rounded-full text-center leading-none font-bold text-stone-900 shadow-[0_3px_8px_rgb(0_0_0/0.25)]"
                            style={{ background: color, rotate: `${[-8, 5, -3][i % 3]}deg`, "--i": i } as CSSProperties}
                          >
                            <span>
                              <span className="block font-display text-2xl">{n}</span>
                              <span className="font-hand text-sm">{label}</span>
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Os gêneros em fitas adesivas: o que eu vi e o que eu ouvi */}
                      {(retro.genres.length > 0 || retro.musicGenres.length > 0) && (
                        <div className="mt-6 flex flex-wrap items-center gap-2" aria-label="Meus gêneros">
                          {[...retro.genres.map((g) => [g, "vi"] as const), ...retro.musicGenres.map((g) => [g, "ouvi"] as const)].map(([g, how], i) => (
                            <span
                              key={`${how}-${g}`}
                              className="rise px-3 py-1 font-hand text-lg leading-6 font-bold"
                              style={{
                                background: how === "vi" ? "rgb(242 179 61 / 0.55)" : "rgb(127 165 139 / 0.6)",
                                rotate: `${[-2, 1.5, -1, 2][i % 4]}deg`,
                                clipPath: "polygon(2% 0, 98% 4%, 100% 96%, 0 100%)",
                                "--i": i + 3,
                              } as CSSProperties}
                              title={how === "vi" ? "No que eu vi" : "No que eu ouvi"}
                            >
                              {how === "ouvi" ? "♪ " : ""}
                              {g.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* À direita: os preferidos em polaroides espalhadas e, colados no meio, os post-its */}
                    <div className="relative min-h-80">
                      <ul className="relative h-80" aria-label={`Os que eu mais amei em ${periodName(period)}`}>
                        {retro.loved.slice(0, 5).map((e, i) => (
                          <li
                            key={e.id}
                            className="group absolute w-24 transition hover:z-20 hover:scale-105 sm:w-32"
                            style={{ ...COLLAGE[i], zIndex: i + 1 } as CSSProperties}
                          >
                            <Link to={`/media/${e.media.id}`} className="block" title={e.media.title}>
                              <Polaroid position={i} tape caption={`nº ${i + 1}`} album={e.media.type === "album"} straightenOnHover={false}>
                                <Poster media={e.media} compact rounded="rounded-[2px]" />
                              </Polaroid>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <HeartDoodle className="absolute -top-2 left-1/2 h-9 w-9 -rotate-12 text-[#e8735a]" />
                      <div className="mt-4 flex flex-wrap gap-3 xl:absolute xl:right-0 xl:bottom-0 xl:mt-0">
                        {retro.average != null && (
                          <p className="postit flex h-24 w-24 flex-col justify-center text-center" style={{ "--note": "#f6d27a", rotate: "4deg" } as CSSProperties}>
                            <span className="font-hand text-3xl leading-none font-bold">{formatRating(retro.average)}</span>
                            <span className="font-hand text-sm leading-4 font-semibold">nota média</span>
                          </p>
                        )}
                        {retro.age != null && (
                          <p className="postit flex h-24 w-24 flex-col justify-center text-center" style={{ "--note": "#b7d1b9", rotate: "-5deg" } as CSSProperties}>
                            <span className="font-hand text-3xl leading-none font-bold">{retro.age}</span>
                            <span className="font-hand text-sm leading-4 font-semibold">anos: a idade do meu gosto</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-xl font-bold">Meu cartão</h2>
                  <p className="mt-1 text-sm text-muted">Para guardar ou mandar para alguém.</p>
                  {card ? (
                    <img
                      src={card.url}
                      alt={`Cartão da retrospectiva de ${periodName(period)}: ${retro.archetype.name}`}
                      className="mt-3 w-full rounded-md shadow-[0_8px_24px_rgb(0_0_0/0.5)]"
                    />
                  ) : (
                    <HandNote className="mt-3">Desenhando o cartão...</HandNote>
                  )}
                  {undated > 0 && (
                    <p className="mt-3 text-xs text-muted">
                      {undated === 1 ? "1 registro sem data ficou de fora." : `${undated} registros sem data ficaram de fora.`}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {card && (
                      <a className="btn-primary" href={card.url} download={fileName}>
                        Baixar o cartão
                      </a>
                    )}
                    {canShare && file && (
                      <button
                        className="btn-ghost"
                        onClick={() => navigator.share({ files: [file], title: "Minha retrospectiva no Tastory" }).catch(() => {})}
                      >
                        Compartilhar o cartão
                      </button>
                    )}
                  </div>
                </div>
              </section>


              {retro.revisited.length > 0 && (
                <section className="mt-10">
                  <h2 className="font-display text-xl font-bold">Os que eu revisitei</h2>
                  <ul className="mt-3 space-y-1 text-sm">
                    {retro.revisited.map(({ entry, times }) => (
                      <li key={entry.media.id}>
                        <Link to={`/media/${entry.media.id}`} className="font-semibold hover:text-accent">
                          {entry.media.title}
                        </Link>{" "}
                        <span className="text-muted">{times} registros no diário</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}
