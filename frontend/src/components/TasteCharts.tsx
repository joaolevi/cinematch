import { useEffect, useState, type ReactNode } from "react";
import { plural } from "../format";
import type { Bar, DiaryFilter, TasteCharts } from "../taste";
import HandNote from "./HandNote";

// Cor de quem fica em segundo plano: contraste de 3:1 com o fundo dos cards
const QUIET = "#76655b";
const TYPE_COLORS = ["#e8735a", "#f2b33d"]; // filme coral, série âmbar, como em MEDIA_STYLE

type Pick = (filter: DiaryFilter) => void;

/** As barras nascem em zero e crescem até o valor. Quando os números mudam, elas deslizam até o novo valor. */
function useGrown(): boolean {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => setGrown(true))));
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return grown;
}

const GROW = "transition-all duration-700 ease-out motion-reduce:transition-none";

function leader(bars: Bar[]): number {
  return bars.reduce((best, bar, i) => (bar.value > bars[best].value ? i : best), 0);
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="text-xs text-muted">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Barras deitadas, com o valor na ponta. Só a maior ganha cor. Clicar mostra esses títulos no diário. */
function BarList({ bars, color, total, onPick }: { bars: Bar[]; color: string; total: number; onPick: Pick }) {
  const grown = useGrown();
  const max = Math.max(...bars.map((b) => b.value), 1);
  const top = leader(bars);
  return (
    <ul className="-mx-2 space-y-0.5">
      {bars.map((bar, i) => (
        <li key={bar.label}>
          <button
            type="button"
            disabled={bar.value === 0}
            onClick={() => onPick(bar.filter)}
            title={`${bar.label}: ${plural(bar.value, "título", "títulos")} (${Math.round((bar.value / Math.max(total, 1)) * 100)}% do diário). Clique para ver.`}
            className="group grid w-full cursor-pointer grid-cols-[7.5rem_1fr] items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="truncate text-stone-200 group-hover:text-cream">{bar.label}</span>
            <span className="flex items-center gap-2">
              <span
                className={`h-3.5 rounded-r group-hover:brightness-125 ${GROW}`}
                style={{
                  width: grown ? `${(bar.value / max) * 85}%` : "0%",
                  minWidth: grown && bar.value ? 4 : 0,
                  background: i === top ? color : QUIET,
                  transitionDelay: `${i * 60}ms`,
                }}
              />
              <span className="text-xs font-bold text-stone-200 tabular-nums">{bar.value}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Colunas das notas, de 0,5 a 5. O número fica na coluna mais alta; os outros aparecem ao passar o mouse ou focar. */
function RatingColumns({ bars, onPick }: { bars: Bar[]; onPick: Pick }) {
  const grown = useGrown();
  const max = Math.max(...bars.map((b) => b.value), 1);
  const top = leader(bars);
  return (
    <>
      <div className="flex h-36 items-end justify-between gap-1 border-b border-line">
        {bars.map((bar, i) => (
          <button
            key={bar.label}
            type="button"
            disabled={bar.value === 0}
            onClick={() => onPick(bar.filter)}
            aria-label={`${plural(bar.value, "título", "títulos")} com nota ${bar.label}`}
            className="group relative flex h-full flex-1 cursor-pointer flex-col items-center justify-end outline-offset-2 disabled:cursor-default"
          >
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-bg px-2 py-1 text-xs whitespace-nowrap text-stone-100 shadow-lg group-hover:block group-focus-visible:block"
            >
              <strong>{bar.value}</strong> <span className="text-muted">com nota {bar.label}</span>
            </span>
            {i === top && bar.value > 0 && <span className="mb-1 text-xs font-bold text-stone-200">{bar.value}</span>}
            <span
              className={`w-full max-w-6 rounded-t group-hover:brightness-125 ${GROW}`}
              style={{
                height: grown ? `${(bar.value / max) * 100}%` : "0%",
                minHeight: grown && bar.value ? 4 : 0,
                background: i === top ? "#e8735a" : QUIET,
                transitionDelay: `${i * 40}ms`,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-1 text-[11px] text-muted tabular-nums">
        {bars.map((bar) => (
          <span key={bar.label} className="flex-1 text-center">
            {bar.label}
          </span>
        ))}
      </div>
    </>
  );
}

/** Uma barra só, dividida entre filmes e séries, com a parte de cada um escrita dentro. */
function Split({ bars, onPick }: { bars: Bar[]; onPick: Pick }) {
  const grown = useGrown();
  const total = bars.reduce((sum, b) => sum + b.value, 0) || 1;
  const share = (n: number) => Math.round((n / total) * 100);
  const parts = bars.map((bar, i) => ({ ...bar, color: TYPE_COLORS[i] })).filter((p) => p.value > 0);
  return (
    <>
      <div className="flex h-7 gap-0.5">
        {parts.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onPick(p.filter)}
            aria-label={`${p.label}: ${p.value} (${share(p.value)}%). Ver no diário`}
            title={`${p.label}: ${p.value} (${share(p.value)}%). Clique para ver.`}
            className={`flex cursor-pointer items-center overflow-hidden rounded px-2 text-xs font-bold text-bg hover:brightness-110 ${GROW}`}
            style={{ width: grown ? `${(p.value / total) * 100}%` : `${100 / parts.length}%`, background: p.color }}
          >
            {share(p.value) >= 15 && `${share(p.value)}%`}
          </button>
        ))}
      </div>
      <ul className="mt-2 flex gap-4 text-xs text-stone-300">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label}: {p.value}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function TasteChartsView({ data, onPick }: { data: TasteCharts; onPick: Pick }) {
  const rated = data.ratings.reduce((sum, b) => sum + b.value, 0);
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      <ChartCard title="Os gêneros que eu mais vejo" subtitle="Quantos títulos do meu diário têm cada gênero">
        <BarList bars={data.genres} color="#f2b33d" total={data.total} onPick={onPick} />
      </ChartCard>
      {data.decades.length > 0 && (
        <ChartCard title="Minhas décadas" subtitle="Quando saíram os títulos que eu registrei">
          <BarList bars={data.decades} color="#e8735a" total={data.total} onPick={onPick} />
        </ChartCard>
      )}
      <ChartCard
        title="Como eu dou notas"
        subtitle={
          rated
            ? `Quantos títulos receberam cada nota, de ${plural(rated, "nota dada", "notas dadas")}`
            : "Quando eu der notas, elas aparecem aqui"
        }
      >
        {rated > 0 ? (
          <RatingColumns bars={data.ratings} onPick={onPick} />
        ) : (
          <HandNote>Nenhuma nota ainda.</HandNote>
        )}
      </ChartCard>
      <ChartCard title="Filmes e séries" subtitle="Como o meu diário se divide">
        <Split bars={data.types} onPick={onPick} />
      </ChartCard>
      {data.creators.length > 0 && (
        <ChartCard title="Quem mais aparece" subtitle="Direção e criação com mais títulos no meu diário">
          <BarList bars={data.creators} color="#7fa58b" total={data.total} onPick={onPick} />
        </ChartCard>
      )}
    </div>
  );
}
