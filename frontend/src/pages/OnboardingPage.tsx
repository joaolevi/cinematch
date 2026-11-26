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

const LAST_STEP = 6;
const ALBUM_COUNT = 18;
const ARTIST_COUNT = 24;
const TITLE_COUNT = 24;
const POPULAR_POOL = 60;

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const decadeLabel = (decade: number) => (decade < 2000 ? `Anos ${decade % 100}` : `Anos ${decade}`);

/** Quantas etiquetas a pessoa já escolheu nesta página, ou o convite para tocar nelas. */
function Picked({ count, one, many }: { count: number; one: string; many: string }) {
  return (
    <p aria-live="polite" className={`mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${count ? "bg-accent/15 text-accent" : "text-muted"}`}>
      {count ? `✓ ${count} ${count === 1 ? one : many}` : "Toque nas etiquetas para escolher"}
    </p>
  );
}

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

function likedMessage(count: number, noun = "títulos"): string {
  if (count === 0) return "Toque nos que você curtiu. Três já fazem diferença.";
  if (count === 1) return "Boa! Mais dois e as sugestões ficam bem melhores.";
  if (count === 2) return "Quase lá! Só mais um.";
  return `Perfeito, ${count} ${noun} marcados. Agora dá para acertar bem!`;
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
  const [musicGenres, setMusicGenres] = useState<string[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<Set<string>>(new Set());
  const [artists, setArtists] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [albums, setAlbums] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = user?.name.split(" ")[0];
  const interestCount = selectedDecades.size + selectedCreators.size;

  useEffect(() => {
    api.genres().then(setGenres).catch((e) => setError(e.message));
    api.genres("album").then(setMusicGenres).catch(() => {});
    api
      .getPreferences()
      .then((p) => {
        setSelectedGenres(new Set(p.genres));
        setSelectedMusic(new Set(p.genres)); // cada passo só mostra e salva os gêneros da sua mídia
        setSelectedDecades(new Set(p.decades));
        setSelectedCreators(new Set(p.creators));
        setSelectedArtists(new Set(p.artists ?? []));
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

  const chosenMusic = () => [...selectedMusic].filter((g) => musicGenres.includes(g));

  // Passo 5: os artistas mais ouvidos dos gêneros musicais escolhidos (ou de todos)
  async function showArtists() {
    goTo(5);
    setLoading(true);
    try {
      const facets = await api.facets(chosenMusic(), "album", ARTIST_COUNT);
      setArtists([...new Set([...selectedArtists, ...facets.creators])]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Passo 6: os discos dos artistas escolhidos primeiro, depois os mais ouvidos dos gêneros (ou de todos)
  async function showAlbums() {
    goTo(6);
    setAlbums([]);
    setLoading(true);
    try {
      const genresChosen = chosenMusic();
      const [byArtist, byGenre] = await Promise.all([
        Promise.all([...selectedArtists].map((person) => api.search({ type: "album", person, limit: 4 }))),
        Promise.all(
          genresChosen.length
            ? genresChosen.map((genre) => api.search({ type: "album", genre, limit: ALBUM_COUNT }))
            : [api.search({ type: "album", limit: ALBUM_COUNT })],
        ),
      ]);
      // Os discos dos artistas escolhidos vêm primeiro; depois, os dos gêneros, intercalados (sem repetir)
      const artistAlbums = interleave(byArtist.map((p) => p.items));
      const genreAlbums = interleave(byGenre.map((p) => p.items));
      setAlbums(interleave([[...artistAlbums, ...genreAlbums]]).slice(0, ALBUM_COUNT));
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
          ? { genres: [], decades: [], creators: [], artists: [], liked_media_ids: [] }
          : {
              genres: [
                ...[...selectedGenres].filter((g) => genres.includes(g)),
                ...[...selectedMusic].filter((g) => musicGenres.includes(g)),
              ],
              decades: [...selectedDecades],
              creators: [...selectedCreators],
              artists: [...selectedArtists],
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
            <Picked count={selectedGenres.size} one="gênero escolhido" many="gêneros escolhidos" />
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
            <Picked count={interestCount} one="escolha" many="escolhas" />
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
            <p className="mt-1 text-muted">{likedMessage(titles.filter((m) => liked.has(m.id)).length)}</p>
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
            <button className="btn-primary px-6" onClick={() => goTo(4)}>
              Continuar para a música
            </button>
            <button className="btn-ghost" disabled={saving} onClick={() => goTo(2)}>
              Voltar
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div>
            <h1 className="text-3xl font-bold">E o que você curte ouvir?</h1>
            <p className="mt-1 text-muted">
              {selectedMusic.size === 0
                ? "A gente liga a música aos seus filmes e séries: a trilha, quem compôs, quem canta e atua."
                : genreMessage(chosenMusic())}
            </p>
            <Picked count={chosenMusic().length} one="gênero escolhido" many="gêneros escolhidos" />
          </div>
          {page(
            "Querido diário, eu ouço:",
            <div className="flex flex-wrap gap-x-3 gap-y-3">
              {musicGenres.map((g, position) => (
                <button
                  key={g}
                  aria-pressed={selectedMusic.has(g)}
                  onClick={() => toggle(selectedMusic, g, setSelectedMusic)}
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
            <button className="btn-primary px-6" onClick={showArtists}>
              Continuar
            </button>
            <button className="btn-ghost" onClick={() => goTo(3)}>
              Voltar
            </button>
            {/* Para quem não liga para música: salva o que já escolheu e vai para as sugestões */}
            <button className="btn-ghost" disabled={saving} onClick={() => finish(false)}>
              Pular a música
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Tem algum artista que você ama?</h1>
            <p className="mt-1 text-muted">{interestMessage(selectedArtists.size)}</p>
            <Picked count={selectedArtists.size} one="artista escolhido" many="artistas escolhidos" />
          </div>
          {loading && <HandNote>Procurando artistas a sua cara...</HandNote>}
          {artists.length > 0 &&
            page(
              "E não paro de ouvir:",
              <div className="flex flex-wrap gap-x-3 gap-y-3">
                {artists.map((a, position) => (
                  <button
                    key={a}
                    aria-pressed={selectedArtists.has(a)}
                    onClick={() => toggle(selectedArtists, a, setSelectedArtists)}
                    className="tape-chip"
                    style={tape(position)}
                  >
                    {a}
                  </button>
                ))}
              </div>,
            )}
          {error && <p className="text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary px-6" onClick={showAlbums}>
              Continuar
            </button>
            <button className="btn-ghost" onClick={() => goTo(4)}>
              Voltar
            </button>
          </div>
        </>
      )}

      {step === 6 && (
        <>
          <div>
            <h1 className="text-3xl font-bold">E que discos você já ouviu e curtiu?</h1>
            <p className="mt-1 text-muted">{likedMessage(albums.filter((m) => liked.has(m.id)).length, "discos")}</p>
          </div>
          {loading && <p className="text-muted">Separando discos para você...</p>}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
            {albums.map((m, position) => (
              <button
                key={m.id}
                onClick={() => toggle(liked, m.id, setLiked)}
                aria-pressed={liked.has(m.id)}
                aria-label={m.title}
                className="relative cursor-pointer rounded-lg text-left transition hover:-translate-y-0.5"
              >
                {liked.has(m.id) ? (
                  <Polaroid position={position} caption="gostei ♥" straightenOnHover={false} album>
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
            <button className="btn-ghost" disabled={saving} onClick={() => goTo(5)}>
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
