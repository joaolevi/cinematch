import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, asMediaArray } from "../api/client";
import type { Media } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import GenreChip from "../components/GenreChip";
import { Logo } from "../components/Layout";
import Poster from "../components/Poster";

export default function Onboarding() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [genres, setGenres] = useState<string[]>([]);
  const [trending, setTrending] = useState<Media[]>([]);
  const [pickedGenres, setPickedGenres] = useState<Set<string>>(new Set());
  const [pickedMedia, setPickedMedia] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.genres().then(setGenres).catch((e) => setError(e.message));
    api
      .trending({ limit: 18 })
      .then((r) => setTrending(asMediaArray(r)))
      .catch((e) => setError(e.message));
  }, []);

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setter(n);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.savePreferences({ genres: [...pickedGenres], liked_media_ids: [...pickedMedia] });
      await refresh();
      nav("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Logo />
      <h1 className="mt-6 text-3xl font-bold">Conte o que você gosta</h1>
      <p className="mt-2 text-muted">Escolha gêneros e títulos para começarmos a recomendar.</p>

      <h2 className="mt-8 text-lg font-semibold">Gêneros</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {genres.map((g) => (
          <GenreChip key={g} genre={g} active={pickedGenres.has(g)} onClick={() => toggle(pickedGenres, g, setPickedGenres)} />
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Títulos que você curte</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {trending.map((m) => {
          const on = pickedMedia.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(pickedMedia, m.id, setPickedMedia)}
              className={`cursor-pointer rounded-xl border-2 p-1 text-left transition ${
                on ? "border-accent bg-accent/10" : "border-transparent hover:border-line"
              }`}
            >
              <Poster media={m} />
              <span className="mt-1.5 line-clamp-1 block text-xs font-medium">{m.title}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <div className="mt-8 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy || pickedGenres.size === 0}>
          {busy ? "Salvando…" : "Continuar"}
        </button>
        {pickedGenres.size === 0 && <span className="text-sm text-muted">Escolha ao menos um gênero.</span>}
      </div>
    </div>
  );
}
