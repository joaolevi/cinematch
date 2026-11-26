import { Link } from "react-router-dom";
import { MEDIA_STYLE, formatMinutes, verbs } from "../format";
import { moodLabel, useMoods } from "../moods";
import type { FeedbackAction, Media, Recommendation } from "../types";
import { TAPE_COLORS } from "../ui";
import ActionIcon from "./ActionIcon";
import GenreChip from "./GenreChip";
import Poster from "./Poster";

export type Act = (media: Media, action: FeedbackAction) => void;

export function Buttons({
  rec,
  act,
  onSeen,
  big = false,
}: {
  rec: Recommendation;
  act: Act;
  onSeen: () => void;
  big?: boolean;
}) {
  const words = verbs(rec.media.type);
  // Nos cards, os botões são claros e numa linha só: com 20 cards na tela, botões cheios de cor viram uma parede de
  // coral e âmbar. A cor continua dizendo o que cada um faz, e o botão se enche ao passar o mouse
  const want = big ? "btn-want px-5 whitespace-nowrap" : "btn min-w-0 bg-coral/15 px-1.5 py-1.5 text-[13px] whitespace-nowrap text-coral hover:bg-coral hover:text-bg";
  const seen = big ? "btn-seen px-5 whitespace-nowrap" : "btn min-w-0 bg-accent/15 px-1.5 py-1.5 text-[13px] whitespace-nowrap text-accent hover:bg-accent hover:text-bg";
  return (
    <div className={big ? "mt-5 flex flex-wrap gap-2" : "mt-auto grid grid-cols-2 gap-1.5 pt-2.5"}>
      <button className={want} onClick={() => act(rec.media, "want")}>
        {big && <ActionIcon kind="want" className="hidden h-4 w-4 shrink-0 sm:block" />}
        {words.want}
      </button>
      <button className={seen} onClick={onSeen}>
        {big && <ActionIcon kind="seen" className="hidden h-4 w-4 shrink-0 sm:block" />}
        {words.seen}
      </button>
      {big && (
        <button className="btn-skip px-3" onClick={() => act(rec.media, "dismiss")}>
          Não me interesso
        </button>
      )}
    </div>
  );
}

/** "Não me interesso" nos cards menores: um X no canto do pôster, para não gastar uma linha inteira. */
export function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Não me interesso"
      title="Não me interesso"
      className="absolute top-2 right-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-bg/75 text-cream/90 shadow-md backdrop-blur-sm transition hover:bg-coral hover:text-bg"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
      </svg>
    </button>
  );
}

/** A primeira sugestão aparece grande, com o pôster desfocado ao fundo. */
/** Os serviços da pessoa onde o título está (RFF21). */
const MAX_LOGOS = 5;

/** Onde assistir, na sugestão (RFF19, RFF21): os logos dos serviços de assinatura, com os da pessoa em destaque, e
 * "Nos seus serviços: ..." quando o título está em algum que ela marcou. */
export function OnMyServices({
  rec,
  className = "",
  logos: withLogos = true,
}: {
  rec: Recommendation;
  className?: string;
  /** Sem os logos, nos cards pequenos: fica só "Nos seus serviços", que é o que interessa */
  logos?: boolean;
}) {
  const mine = new Set(rec.services ?? []);
  const logos = withLogos ? (rec.streaming ?? []).filter((s) => s.logo).slice(0, MAX_LOGOS) : [];
  if (!logos.length && !mine.size) return null;
  return (
    <div className={className}>
      {logos.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Onde assistir, por assinatura">
          {logos.map((s) => (
            <li key={s.key}>
              <img
                src={s.logo!}
                alt={s.label}
                title={mine.has(s.label) ? `${s.label}: você assina` : s.label}
                loading="lazy"
                className={`h-6 w-6 rounded-md ${mine.has(s.label) ? "ring-2 ring-accent" : "opacity-80"}`}
              />
            </li>
          ))}
        </ul>
      )}
      {mine.size > 0 && (
        <p className={`${logos.length ? "mt-1 " : ""}font-semibold text-accent`}>Nos seus serviços: {[...mine].join(", ")}</p>
      )}
    </div>
  );
}

const CREATOR_LABEL: Record<Media["type"], string> = { movie: "Direção", series: "Criação", album: "Artista" };

/** A ficha do título, à direita da aposta nas telas largas: quem fez, quanto dura e o clima. */
function Ficha({ media }: { media: Media }) {
  const moods = useMoods();
  const lines: [string, string][] = [];
  if (media.creators.length) lines.push([CREATOR_LABEL[media.type], media.creators.slice(0, 2).join(", ")]);
  if (media.duration_min) lines.push([media.type === "series" ? "Episódios de" : "Duração", formatMinutes(media.duration_min)]);
  if (media.moods?.length) lines.push(["Clima", media.moods.slice(0, 3).map((m) => moodLabel(moods, m)).join(", ")]);
  if (media.year) lines.push(["Ano", String(media.year)]);
  if (lines.length < 2) return null;
  return (
    <aside
      aria-label={`Ficha de ${media.title}`}
      className="paper relative hidden w-80 shrink-0 rotate-2 self-center rounded-sm py-5 pr-5 pl-12 text-[#2b211c] shadow-2xl xl:block"
    >
      <span aria-hidden className="tape -top-2.5 left-10 -rotate-6" style={{ background: TAPE_COLORS[2] }} />
      <p className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">Ficha</p>
      <dl className="space-y-1 text-sm leading-6">
        {lines.map(([label, value]) => (
          <div key={label}>
            <dt className="inline font-bold">{label}: </dt>
            <dd className="inline">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export default function Highlight({
  rec,
  label,
  act,
  onSeen,
}: {
  rec: Recommendation;
  label: string;
  act: Act;
  onSeen: () => void;
}) {
  const { media } = rec;
  return (
    <section className="relative mt-6 overflow-hidden rounded-3xl border border-line bg-surface">
      {media.poster_url && (
        <img
          src={media.poster_url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/75 to-bg/10" />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <Link
          to={`/media/${media.id}`}
          className="relative w-32 shrink-0 -rotate-2 shadow-2xl transition hover:rotate-0 sm:w-44"
        >
          <span
            aria-hidden
            className="tape -top-2 left-1/2 -translate-x-1/2 rotate-2"
            style={{ background: TAPE_COLORS[0] }}
          />
          <Poster media={media} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-hand text-2xl leading-none font-bold text-accent">{label}</p>
          <Link to={`/media/${media.id}`} className="hover:text-accent">
            <h2 className="mt-1 font-display text-3xl leading-tight font-bold sm:text-4xl">{media.title}</h2>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold" style={{ color: MEDIA_STYLE[media.type].color }}>
              {MEDIA_STYLE[media.type].label}
            </span>
            {media.year && <span className="text-muted">{media.year}</span>}
            {media.genres.map((g) => (
              <GenreChip key={g} genre={g} small />
            ))}
          </div>
          <p className="mt-3 max-w-2xl font-semibold text-stone-100">{rec.reason}</p>
          <OnMyServices rec={rec} className="mt-1 text-sm" />
          {media.overview && <p className="mt-2 line-clamp-3 max-w-2xl text-sm text-stone-300">{media.overview}</p>}
          <Buttons rec={rec} act={act} onSeen={onSeen} big />
        </div>
        <Ficha media={media} />
      </div>
    </section>
  );
}

/** Ver Recomendações: feed com Quero ver / Já vi / Não me interesso. */
