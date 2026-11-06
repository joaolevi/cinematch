import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Poster from "../components/Poster";
import type { Media } from "../types";

const TITLE_COUNT = 24;

/** Intercala as listas para todos os gêneros aparecerem, sem repetir títulos. */
function mergeByGenre(lists: Media[][], limit: number): Media[] {
  const seen = new Set<number>();
  const merged: Media[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const media = list[i];
      if (media && !seen.has(media.id) && merged.length < limit) {
        seen.add(media.id);
        merged.push(media);
      }
    }
  }
  return merged;
}

/** Definir Preferências Iniciais (onboarding opcional do Diagrama de Atividades). */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [genres, setGenres] = useState<string[]>([]);
  const [titles, setTitles] = useState<Media[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.genres().then(setGenres).catch((e) => setError(e.message));
    api
      .getPreferences()
      .then((p) => setSelectedGenres(new Set(p.genres)))
      .catch(() => {});
  }, []);

  const toggle = <T,>(set: Set<T>, value: T, update: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  };

  function goTo(next: 1 | 2) {
    setError(null);
    setStep(next);
    window.scrollTo(0, 0);
  }

  async function showTitles() {
    goTo(2);
    setTitles([]);
    setLoading(true);
    try {
      if (selectedGenres.size === 0) {
        setTitles(await api.trending(undefined, TITLE_COUNT));
      } else {
        const results = await Promise.all(
          [...selectedGenres].map((genre) => api.search({ genre, limit: TITLE_COUNT })),
        );
        setTitles(mergeByGenre(results.map((r) => r.items), TITLE_COUNT));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function finish(skip = false) {
    setSaving(true);
    try {
      await api.setPreferences(skip ? [] : [...selectedGenres], skip ? [] : [...liked]);
      await refresh();
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Passo {step} de 2</p>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full bg-accent transition-all ${step === 1 ? "w-1/2" : "w-full"}`} />
        </div>
      </div>

      {step === 1 ? (
        <>
          <div>
            <h1 className="text-3xl font-bold">Quais gêneros você curte?</h1>
            <p className="mt-1 text-muted">
              Vamos usar sua escolha para mostrar títulos no próximo passo e montar suas primeiras recomendações.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => toggle(selectedGenres, g, setSelectedGenres)}
                className={`chip cursor-pointer px-4 py-1.5 text-sm transition ${
                  selectedGenres.has(g) ? "border-accent bg-accent/15 text-accent" : "hover:border-slate-400"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {error && <p className="text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary px-6" onClick={showTitles}>
              Continuar
            </button>
            <button className="btn-ghost" disabled={saving} onClick={() => finish(true)}>
              Pular por enquanto
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold">Marque o que você já viu e gostou</h1>
            <p className="mt-1 text-muted">
              {selectedGenres.size > 0 ? "Títulos populares dos gêneros que você escolheu." : "Títulos populares no Tastory."}{" "}
              {liked.size} selecionado(s).
            </p>
          </div>
          {loading && <p className="text-muted">Carregando títulos...</p>}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {titles.map((m) => (
              <button
                key={m.id}
                onClick={() => toggle(liked, m.id, setLiked)}
                className={`relative cursor-pointer rounded-lg text-left ring-2 transition ${
                  liked.has(m.id) ? "ring-accent" : "ring-transparent hover:ring-line"
                }`}
              >
                <Poster media={m} />
                {liked.has(m.id) && (
                  <span className="absolute top-2 right-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-bg">✓</span>
                )}
              </button>
            ))}
          </div>
          {error && <p className="text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary px-6" disabled={saving} onClick={() => finish(false)}>
              Ver minhas recomendações
            </button>
            <button className="btn-ghost" disabled={saving} onClick={() => goTo(1)}>
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
