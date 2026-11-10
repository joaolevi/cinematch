import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Polaroid from "../components/Polaroid";
import { TAB_COLORS, TAPE_COLORS } from "../ui";
import Poster from "../components/Poster";
import type { Media } from "../types";
import { diaryChanged } from "../seen";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";

const LAST_STEP = 3;
const TITLE_COUNT = 24;
const POPULAR_POOL = 60;

type Step = 1 | 2 | 3;

const decadeLabel = (decade: number) => (decade < 2000 ? `Anos ${decade % 100}` : `Anos ${decade}`);

function genreMessage(selected: string[]): string {
  if (selected.length === 0) return "Escolha quantos quiser. Isso já nos dá uma boa pista.";
  if (selected.length === 1) return `Boa! ${selected[0]} é um ótimo começo.`;
  if (selected.length <= 4) return "Ótimo gosto! Já estamos conhecendo você.";
  return "Eclético, hein? Vai ter muita coisa boa por aqui.";
}

function interestMessage(count: number): string {
  if (count === 0) return "Essa parte é opcional, mas ajuda a acertar mais.";
  if (count === 1) return "Anotado! Pode marcar mais, se quiser.";
  return "Perfeito, isso ajuda bastante.";
}

function likedMessage(count: number): string {
  if (count === 0) return "Toque nos que você curtiu. Três já fazem diferença.";
  if (count === 1) return "Boa! Mais dois e as sugestões ficam bem melhores.";
  if (count === 2) return "Quase lá! Só mais um.";
  return `Perfeito, ${count} títulos marcados. Agora dá para acertar bem!`;
}

/** Intercala as listas para todas as escolhas aparecerem, sem repetir títulos. */
function interleave(lists: Media[][]): Media[] {
  const seen = new Set<number>();
  const merged: Media[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const media = list[i];
      if (media && !seen.has(media.id)) {
        seen.add(media.id);
        merged.push(media);
      }
    }
  }
  return merged;
}

/** Definir Preferências Iniciais (onboarding opcional do Diagrama de Atividades). */
export default function OnboardingPage() {
  usePageTitle("Conte o que você curte");
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [genres, setGenres] = useState<string[]>([]);
  const [decades, setDecades] = useState<number[]>([]);
  const [creators, setCreators] = useState<string[]>([]);
  const [titles, setTitles] = useState<Media[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedDecades, setSelectedDecades] = useState<Set<number>>(new Set());
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = user?.name.split(" ")[0];
  const interestCount = selectedDecades.size + selectedCreators.size;

  useEffect(() => {
    api.genres().then(setGenres).catch((e) => setError(e.message));
    api
      .getPreferences()
      .then((p) => {
        setSelectedGenres(new Set(p.genres));
        setSelectedDecades(new Set(p.decades));
        setSelectedCreators(new Set(p.creators));
      })
      .catch(() => {});
  }, []);

  const toggle = <T,>(set: Set<T>, value: T, update: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  };

  function goTo(next: Step) {
    setError(null);
    setStep(next);
    window.scrollTo(0, 0);
  }

  async function showInterests() {
    goTo(2);
    setLoading(true);
    try {
      const facets = await api.facets([...selectedGenres]);
      setDecades([...new Set([...selectedDecades, ...facets.decades])].sort((a, b) => b - a));
      setCreators([...new Set([...selectedCreators, ...facets.creators])]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function showTitles() {
    goTo(3);
    setTitles([]);
    setLoading(true);
    try {
      const searches = [
        ...[...selectedCreators].map((q) => api.search({ q, limit: 8 })),
        ...[...selectedGenres].map((genre) => api.search({ genre, limit: POPULAR_POOL })),
      ];
      const lists = (await Promise.all(searches)).map((r) => r.items);
      const pool = lists.length > 0 ? interleave(lists) : await api.trending(undefined, POPULAR_POOL);
      const inChosenDecade = (m: Media) => m.year !== null && selectedDecades.has(Math.floor(m.year / 10) * 10);
      const ordered = [...pool.filter(inChosenDecade), ...pool.filter((m) => !inChosenDecade(m))];
      setTitles(ordered.slice(0, TITLE_COUNT));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function finish(skip = false) {
    // Quem já tinha feito o onboarding e pula mantém o que escolheu antes
    if (skip && user?.onboarded) {
      navigate("/para-voce");
      return;
    }
    setSaving(true);
    try {
      await api.setPreferences(
        skip
          ? { genres: [], decades: [], creators: [], liked_media_ids: [] }
          : {
              genres: [...selectedGenres],
              decades: [...selectedDecades],
              creators: [...selectedCreators],
              liked_media_ids: [...liked],
            },
      );
      diaryChanged(); // os títulos marcados entram no diário e ganham o selo Visto
      await refresh();
      navigate("/para-voce");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  // Os gêneros, as épocas e os diretores ficam numa folha do diário; o escolhido fica marcado em tinta vermelha
  // Cada opção é um pedaço de fita colorida, levemente torto, como as fitas que prendem as polaroides
  const TILT = [-2, 1.5, -1, 2, -1.5, 1];
  const tape = (position: number) =>
    ({ "--tape": TAB_COLORS[position % TAB_COLORS.length], rotate: `${TILT[position % TILT.length]}deg` }) as React.CSSProperties;
  const page = (note: string, children: React.ReactNode) => (
    <section className="paper relative -rotate-[0.25deg] rounded-sm py-6 pr-6 pl-14 sm:pl-16">
      <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
      <span aria-hidden className="tape -top-2.5 right-16 rotate-3" style={{ background: TAPE_COLORS[2] }} />
      <p className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">{note}</p>
      <div className="mt-2">{children}</div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">
          Passo {step} de {LAST_STEP}
        </p>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${(step / LAST_STEP) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <>
          <div>
            <h1 className="text-3xl font-bold">
              {firstName ? `Oi, ${firstName}! O que você curte assistir?` : "O que você curte assistir?"}
            </h1>
            <p className="mt-1 text-muted">{genreMessage([...selectedGenres])}</p>
          </div>
          {page(
            "Querido diário, eu curto:",
            <div className="flex flex-wrap gap-x-3 gap-y-3">
              {genres.map((g, position) => (
                <button
                  key={g}
                  aria-pressed={selectedGenres.has(g)}
                  onClick={() => toggle(selectedGenres, g, setSelectedGenres)}
                  className="tape-chip"
                  style={tape(position)}
                >
                  {g}
                </button>
              ))}
            </div>,
          )}
          {error && <p className="text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary px-6" onClick={showInterests}>
              Continuar
            </button>
            <button className="btn-ghost" disabled={saving} onClick={() => finish(true)}>
              Pular por enquanto
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Tem alguma época ou diretor que você ama?</h1>
            <p className="mt-1 text-muted">{interestMessage(interestCount)}</p>
          </div>
          {loading && <HandNote>Procurando opções a sua cara...</HandNote>}
          {(decades.length > 0 || creators.length > 0) &&
            page(
              "E também gosto de:",
              <div className="space-y-5">
                {decades.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold">Épocas</h2>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-3">
                      {decades.map((d, position) => (
                        <button
                          key={d}
                          aria-pressed={selectedDecades.has(d)}
                          onClick={() => toggle(selectedDecades, d, setSelectedDecades)}
                          className="tape-chip"
                  style={tape(position)}
                        >
                          {decadeLabel(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {creators.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold">Diretores e criadores</h2>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-3">
                      {creators.map((c, position) => (
                        <button
                          key={c}
                          aria-pressed={selectedCreators.has(c)}
                          onClick={() => toggle(selectedCreators, c, setSelectedCreators)}
                          className="tape-chip"
                  style={tape(position)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>,
            )}
          {error && <p className="text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary px-6" onClick={showTitles}>
              Continuar
            </button>
            <button className="btn-ghost" onClick={() => goTo(1)}>
              Voltar
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div>
            <h1 className="text-3xl font-bold">E o que você já viu e gostou?</h1>
            <p className="mt-1 text-muted">{likedMessage(liked.size)}</p>
          </div>
          {loading && <p className="text-muted">Separando títulos para você...</p>}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
            {titles.map((m) => (
              <button
                key={m.id}
                onClick={() => toggle(liked, m.id, setLiked)}
                aria-pressed={liked.has(m.id)}
                aria-label={m.title}
                className="relative cursor-pointer rounded-lg text-left transition hover:-translate-y-0.5"
              >
                {/* O que a pessoa marca vira polaroide colada no diário dela */}
                {liked.has(m.id) ? (
                  <Polaroid position={titles.indexOf(m)} caption="gostei ♥" straightenOnHover={false}>
                    <Poster media={m} rounded="rounded-[2px]" />
                  </Polaroid>
                ) : (
                  <Poster media={m} />
                )}
              </button>
            ))}
          </div>
          {error && <p className="text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary px-6" disabled={saving} onClick={() => finish(false)}>
              {liked.size > 0 ? "Ver minhas recomendações" : "Ver sugestões assim mesmo"}
            </button>
            <button className="btn-ghost" disabled={saving} onClick={() => goTo(2)}>
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
