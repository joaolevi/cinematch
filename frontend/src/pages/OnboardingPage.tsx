import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Poster from "../components/Poster";
import type { Media } from "../types";

/** Definir Preferências Iniciais (onboarding opcional do Diagrama de Atividades). */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [genres, setGenres] = useState<string[]>([]);
  const [popular, setPopular] = useState<Media[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.genres().then(setGenres).catch((e) => setError(e.message));
    api.trending(undefined, 24).then(setPopular).catch((e) => setError(e.message));
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
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Passo 1 de 2</p>
        <h1 className="mt-1 text-3xl font-bold">Quais gêneros você curte?</h1>
        <p className="mt-1 text-muted">Usamos isso para a primeira rodada de recomendações.</p>
        <div className="mt-4 flex flex-wrap gap-2">
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
      </div>

      <div>
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Passo 2 de 2</p>
        <h2 className="mt-1 text-3xl font-bold">Marque o que você já viu e gostou</h2>
        <p className="mt-1 text-muted">
          {liked.size} selecionado(s). Quanto mais, melhor — mas pode pular.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {popular.map((m) => (
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
      </div>

      {error && <p className="text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary px-6" disabled={saving} onClick={() => finish(false)}>
          Ver minhas recomendações
        </button>
        <button className="btn-ghost" disabled={saving} onClick={() => finish(true)}>
          Pular por enquanto
        </button>
      </div>
    </div>
  );
}
