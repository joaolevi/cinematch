import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import HandNote from "../components/HandNote";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import { StarsDisplay } from "../components/Stars";
import { formatRating } from "../format";
import { genreList, monthName, periodName, retroOf, retroPeriods, type RetroPeriod } from "../retro";
import { drawRetroCard } from "../retroCard";
import type { DiaryEntry } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

const INK = "text-[#2b211c]";
const RED_INK = "text-[#b9452f]";

/** O período da URL (?ano=2026&mes=11), ou o ano mais recente com registros datados. */
function periodFrom(params: URLSearchParams, years: { year: number; months: number[] }[]): RetroPeriod | null {
  const year = Number(params.get("ano")) || years[0]?.year;
  if (!year) return null;
  const month = Number(params.get("mes")) || null;
  return { year, month: month && month >= 1 && month <= 12 ? month : null };
}

/** Retrospectiva do gosto por mês e por ano, com um cartão para compartilhar (RFF05). */
export default function RetroPage() {
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

  const choose = (p: RetroPeriod) => setParams(p.month ? { ano: String(p.year), mes: String(p.month) } : { ano: String(p.year) }, { replace: true });

  if (error) return <HandNote>{error}</HandNote>;
  if (!entries) return <HandNote>Folheando o diário...</HandNote>;

  const fileName = period ? `retrospectiva-tastory-${period.year}${period.month ? `-${String(period.month).padStart(2, "0")}` : ""}.png` : "";
  const file = card ? new File([card.blob], fileName, { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  const months = years.find((y) => y.year === period?.year)?.months ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold">Minha retrospectiva</h1>
      <p className="font-hand text-2xl font-bold text-accent">o meu gosto, mês a mês</p>

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
                <div className={`paper relative -rotate-[0.3deg] rounded-sm py-7 pr-6 pl-14 sm:pr-8 sm:pl-16 ${INK}`}>
                  <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
                  <span aria-hidden className="tape -top-2.5 right-16 rotate-3" style={{ background: TAPE_COLORS[2] }} />
                  <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Em {periodName(period)}, eu fui:</p>
                  <p className="mt-1 inline-block -rotate-2 rounded-lg border-4 border-[#b9452f] px-4 py-1 font-display text-3xl font-bold text-[#b9452f] sm:text-4xl">
                    {retro.archetype.name}
                  </p>
                  <p className="mt-2 font-hand text-2xl leading-8 font-semibold">{retro.archetype.text}</p>

                  {retro.taste && (
                    <p className="mt-5 font-display text-2xl leading-tight font-bold sm:text-3xl">
                      Sou do time <mark className="marker">{retro.taste.highlight}</mark>
                      {retro.taste.decade && (
                        <>
                          {" "}
                          dos{" "}
                          <mark className="marker" style={{ "--marker": "rgb(232 115 90 / 0.5)" } as CSSProperties}>
                            {retro.taste.decade}
                          </mark>
                        </>
                      )}
                      .
                    </p>
                  )}
                  <ul className="mt-3 font-hand text-2xl leading-8 font-semibold opacity-85">
                    <li>→ {retro.counts}</li>
                    {undated > 0 && (
                      <li>→ {undated === 1 ? "1 registro sem data ficou de fora." : `${undated} registros sem data ficaram de fora.`}</li>
                    )}
                    {retro.genres.length > 0 && <li>→ No que eu vi, fui do time {genreList(retro.genres)}.</li>}
                    {retro.musicGenres.length > 0 && <li>→ No que eu ouvi, fui do time {genreList(retro.musicGenres)}.</li>}
                    {retro.age != null && (
                      <li>
                        → A idade do meu gosto: {retro.age === 1 ? "1 ano" : `${retro.age} anos`}, a idade média do que eu vi
                        e ouvi.
                      </li>
                    )}
                    {retro.average != null && <li>→ Minha nota média: {formatRating(retro.average)}.</li>}
                  </ul>
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

              {retro.loved.length > 0 && (
                <section className="mt-12">
                  <h2 className="font-display text-xl font-bold text-accent">Os que eu mais amei em {periodName(period)}</h2>
                  <ol className="mt-5 flex gap-5 overflow-x-auto px-1 pt-2 pb-3 md:grid md:grid-cols-5 md:overflow-visible">
                    {retro.loved.map((e, position) => (
                      <li key={e.id} className="group w-32 shrink-0 md:w-auto md:max-w-48">
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
              )}

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

      <p className="mt-12 text-sm">
        <Link to="/diario?aba=gosto" className="underline hover:text-accent">
          Ver o Meu gosto completo
        </Link>
      </p>
    </div>
  );
}
