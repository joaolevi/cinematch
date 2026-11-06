import { useState } from "react";
import type { Media } from "../api/types";
import StarRating from "./StarRating";

/** Modal do "Já vi": nota em estrelas e resenha opcionais. */
export default function SeenModal({
  media,
  onClose,
  onConfirm,
}: {
  media: Pick<Media, "title">;
  onClose: () => void;
  onConfirm: (rating: number | null, review: string) => Promise<void> | void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onConfirm(rating, review.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-accent">Registrar no diário</p>
        <h2 className="mt-1 text-xl font-bold">{media.title}</h2>

        <p className="mt-5 text-sm font-medium">Sua nota (opcional)</p>
        <div className="mt-2">
          <StarRating value={rating} onChange={setRating} />
        </div>

        <label className="mt-5 block text-sm font-medium" htmlFor="seen-review">
          Resenha (opcional)
        </label>
        <textarea
          id="seen-review"
          className="input mt-2 min-h-24"
          placeholder="O que achou?"
          value={review}
          maxLength={2000}
          onChange={(e) => setReview(e.target.value)}
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? "Salvando…" : "Salvar no diário"}
          </button>
        </div>
      </div>
    </div>
  );
}
