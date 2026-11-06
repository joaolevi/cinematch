import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, asMediaArray } from "../api/client";
import type { Media } from "../api/types";
import { useAuth } from "../auth/AuthContext";
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
    <div className="content narrow">
      <h1>Conte o que você gosta</h1>
      <p className="muted">Escolha gêneros e títulos para começarmos a recomendar.</p>

      <h2>Gêneros</h2>
      <div className="chips">
        {genres.map((g) => (
          <button
            key={g}
            type="button"
            className={"chip" + (pickedGenres.has(g) ? " on" : "")}
            onClick={() => toggle(pickedGenres, g, setPickedGenres)}
          >
            {g}
          </button>
        ))}
      </div>

      <h2>Títulos que você curte</h2>
      <div className="grid">
        {trending.map((m) => (
          <button
            key={m.id}
            type="button"
            className={"pick" + (pickedMedia.has(m.id) ? " on" : "")}
            onClick={() => toggle(pickedMedia, m.id, setPickedMedia)}
            aria-pressed={pickedMedia.has(m.id)}
          >
            <Poster title={m.title} url={m.poster_url} />
            <span className="small">{m.title}</span>
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn" onClick={save} disabled={busy || pickedGenres.size === 0}>
        {busy ? "Salvando…" : "Continuar"}
      </button>
    </div>
  );
}
