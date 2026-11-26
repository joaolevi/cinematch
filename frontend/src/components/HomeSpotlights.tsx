import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { MEDIA_STYLE } from "../format";
import { diaryChanged } from "../seen";
import { tasteOf } from "../taste";
import type { DiaryEntry, Pair } from "../types";
import ListName from "./ListName";
import Poster from "./Poster";
import { useTypewriter, WISH_EXAMPLES } from "./WishBox";

/** Pedir do seu jeito, direto do Início: o texto vai para o Para você, que já abre com o pedido feito. */
function AskCard() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const typed = useTypewriter(WISH_EXAMPLES, !focused && !text);
  function go(e: FormEvent) {
    e.preventDefault();
    const q = text.trim() || typed;
    navigate(`/para-voce?pedido=${encodeURIComponent(q)}`);
  }
  return (
    <form
      onSubmit={go}
      role="search"
      aria-label="Pedir do seu jeito"
      className="rise flex flex-col rounded-2xl border border-line bg-gradient-to-br from-surface to-accent/10 p-5"
    >
      <label htmlFor="pedido-inicio" className="font-hand text-2xl leading-7 font-bold text-accent">
        Peça do seu jeito
      </label>
      <p className="mt-1 text-sm text-stone-300">Escreva em português, e o Tastory entende o clima, a ocasião e o tempo.</p>
      <div className="mt-auto flex items-center gap-2 rounded-xl border border-line bg-bg/60 p-1 pl-3 pt-1 transition focus-within:border-accent">
        <div className="relative min-w-0 flex-1">
          <input
            id="pedido-inicio"
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full bg-transparent py-1.5 text-sm text-cream outline-none"
          />
          {!text && (
            <span aria-hidden className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-sm text-muted ${focused ? "" : "caret"}`}>
              {focused ? "o que você quer agora?" : typed}
            </span>
          )}
        </div>
        <button className="btn-primary shrink-0 px-3 py-1.5 text-sm">Pedir</button>
      </div>
    </form>
  );
}

/** "Hoje à noite": abre o Para você com o que cabe na noite e está nos serviços da pessoa. */
function TonightCard() {
  const { user } = useAuth();
  const services = (user?.services.length ?? 0) > 0;
  return (
    <Link
      to="/para-voce?hoje=1"
      style={{ "--i": 1 } as CSSProperties}
      className="rise group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#1a1f38] to-surface p-5 transition hover:border-accent/60"
    >
      <span aria-hidden className="float absolute top-4 right-5 text-4xl" style={{ "--tilt": "-12deg" } as CSSProperties}>
        🌙
      </span>
      <span aria-hidden className="absolute top-12 right-20 h-1 w-1 rounded-full bg-cream/70" />
      <span aria-hidden className="absolute top-6 right-28 h-0.5 w-0.5 rounded-full bg-cream/60" />
      <span aria-hidden className="absolute top-16 right-10 h-0.5 w-0.5 rounded-full bg-cream/50" />
      <span className="font-hand text-2xl leading-7 font-bold text-accent">Hoje à noite</span>
      <span className="mt-1 pr-16 text-sm text-stone-300">
        {services ? "O que cabe na noite e já está nos seus serviços." : "O que cabe na noite, em até 2h30."}
      </span>
      <span className="mt-auto pt-4 text-sm font-bold text-cream group-hover:text-accent">Ver as sugestões →</span>
    </Link>
  );
}

/** A frase do gosto, com o marca-texto se desenhando, e o caminho para a retrospectiva com o cartão de compartilhar. */
function TasteCard({ diary }: { diary: DiaryEntry[] }) {
  const taste = tasteOf(diary);
  return (
    <Link
      to={taste ? "/retrospectiva" : "/diario"}
      style={{ "--i": 2 } as CSSProperties}
      className="rise group flex flex-col rounded-2xl border border-line bg-surface/70 p-5 transition hover:border-accent/60"
    >
      <span className="font-hand text-2xl leading-7 font-bold text-accent">Meu gosto em uma frase</span>
      {taste ? (
        <span className="mt-2 font-display text-xl leading-snug font-bold text-cream">
          Sou do time <mark className="marker marker-draw text-cream" style={{ "--marker": "rgb(242 179 61 / 0.45)" } as CSSProperties}>{taste.highlight}</mark>
          {taste.decade && (
            <>
              {" "}
              dos{" "}
              <mark className="marker marker-draw text-cream" style={{ "--marker": "rgb(232 115 90 / 0.45)" } as CSSProperties}>
                {taste.decade}
              </mark>
            </>
          )}
          .
        </span>
      ) : (
        <span className="mt-2 text-sm text-stone-300">Registre 3 títulos e descubra a frase do seu gosto.</span>
      )}
      <span className="mt-auto pt-4 text-sm font-bold text-cream group-hover:text-accent">
        {taste ? "Ver minha retrospectiva e o cartão →" : "Abrir o diário →"}
      </span>
    </Link>
  );
}

/** Os três atalhos do Início, logo depois da aposta do dia: o que só o Tastory faz, a um clique. */
export function Shortcuts({ diary }: { diary: DiaryEntry[] | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AskCard />
      <TonightCard />
      <TasteCard diary={diary ?? []} />
    </div>
  );
}

const KIND_LABEL: Record<Pair["kind"], string> = {
  soundtrack: "A trilha sonora",
  composer: "Do mesmo compositor",
  same_person: "Quem atua também canta",
  biopic: "A história e o disco",
  documentary: "O documentário e o disco",
};

/**
 * A sessão dupla do dia: um filme ou uma série para ver e um disco para ouvir depois, ligados pela música. O disco sai
 * de dentro da capa e gira, como num toca-discos; a ponte entre os dois fica escrita à mão no meio.
 */
export function DoubleFeatureOfTheDay() {
  const [pair, setPair] = useState<Pair | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .pairs([], {}, 3)
      .then((pairs) => {
        if (!pairs.length) return;
        const day = Math.floor(Date.now() / 86_400_000);
        setPair(pairs[day % pairs.length]); // muda a cada dia
      })
      .catch(() => {});
  }, []);
  if (!pair) return null;
  const video = pair.video.media;
  const album = pair.album;
  return (
    <section aria-labelledby="sessao-dupla-dia" className="rise relative overflow-hidden rounded-2xl border border-line bg-surface/60">
      {video.backdrop_url && (
        <img src={video.backdrop_url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-15 blur-sm" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/70 to-bg/40" />
      <div className="relative grid items-center gap-6 p-5 sm:p-7 md:grid-cols-[auto_minmax(0,1fr)]">
        {/* O par: o pôster e, ao lado, o disco, que desliza e gira ao passar o mouse */}
        <div className="spin-on-hover group flex items-end">
          <Link to={`/media/${video.id}`} aria-label={video.title} className="relative z-10 w-32 shrink-0 -rotate-3 transition group-hover:-rotate-6 sm:w-40">
            <Poster media={video} rounded="rounded-lg" />
          </Link>
          <Link
            to={`/media/${album.id}`}
            aria-label={album.title}
            className="-ml-6 w-32 shrink-0 rotate-2 transition duration-500 group-hover:ml-2 group-hover:rotate-0 sm:-ml-8 sm:w-40"
          >
            <Poster media={album} rounded="rounded-md" />
          </Link>
        </div>
        <div className="min-w-0">
          <p className="font-hand text-2xl leading-7 font-bold text-accent">Sessão dupla do dia</p>
          <h2 id="sessao-dupla-dia" className="mt-1 font-display text-2xl leading-tight font-bold sm:text-3xl">
            <span className="text-base font-normal text-muted">Veja </span>
            <Link to={`/media/${video.id}`} className="hover:text-accent">
              {video.title}
            </Link>
          </h2>
          <p className="mt-1 line-clamp-2 text-lg leading-snug">
            <span className="text-muted">e depois ouça </span>
            <Link to={`/media/${album.id}`} className="font-semibold text-cream hover:text-accent" title={album.title}>
              {album.title}
            </Link>
          </p>
          <p className="mt-3 inline-flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-accent/15 px-3 py-1 font-semibold text-accent">{KIND_LABEL[pair.kind]}</span>
            <span className="text-stone-300">{pair.reason}</span>
          </p>
          <p className="mt-2 text-xs text-muted">
            <span style={{ color: MEDIA_STYLE[video.type].color }} className="font-bold">{MEDIA_STYLE[video.type].label}</span>
            {video.year && ` de ${video.year}`} ·{" "}
            <span style={{ color: MEDIA_STYLE.album.color }} className="font-bold">Álbum</span>
            {album.creators[0] && ` de ${album.creators[0]}`}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className={saved ? "btn-ghost" : "btn-want"}
              disabled={busy || saved}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.feedback(video.id, "want");
                  await api.feedback(album.id, "want");
                  setSaved(true);
                  diaryChanged();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {saved ? (
                <>
                  Os dois estão na sua lista <ListName />
                </>
              ) : busy ? (
                "Guardando..."
              ) : (
                "Guardar os dois no Quero ver"
              )}
            </button>
            <Link to="/para-voce" className="text-sm font-bold text-accent hover:underline">
              Mais sessões duplas →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
