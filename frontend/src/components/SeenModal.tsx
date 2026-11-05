import { useState } from "react";
import type { Media } from "../types";
import { StarsInput } from "./Stars";

/** Modal do "Já vi": registra o consumo com nota em estrelas e resenha opcionais. */
export default function SeenModal({
  media,
  initialRating = null,
  initialReview = "",
  onClose,
  onConfirm,
}: {
  media: Media;
  initialRating?: number | null;
  initialReview?: string;
  onClose: () => void;
  onConfirm: (rating: number | null, review: string, consumedAt: string) => Promise<void> | void;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [review, setReview] = useState(initialReview);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Registrar consumo</p>
        <h2 className="mt-1 text-xl font-bold">{media.title}</h2>

        <label className="mt-5 block text-sm font-medium">Nota (opcional)</label>
        <div className="mt-2">
          <StarsInput value={rating} onChange={setRating} />
        </div>

        <label className="mt-5 block text-sm font-medium" htmlFor="seen-date">
          Quando você viu?
        </label>
        <input id="seen-date" type="date" className="input mt-2" value={date} onChange={(e) => setDate(e.target.value)} />

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

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(rating, review, date);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando..." : "Salvar no diário"}
          </button>
        </div>
      </div>
    </div>
  );
}
