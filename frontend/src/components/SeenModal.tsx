import { useState } from "react";
import { localDate } from "../format";
import type { Media } from "../types";
import { StarsInput } from "./Stars";

const QUICK_DATES = [
  { label: "Hoje", daysAgo: 0 },
  { label: "Ontem", daysAgo: 1 },
];

/** Modal do "Já vi": registra o consumo com nota em estrelas e resenha opcionais. */
export default function SeenModal({
  media,
  initialRating = null,
  initialReview = "",
  initialDate = null,
  onClose,
  onConfirm,
}: {
  media: Media;
  initialRating?: number | null;
  initialReview?: string;
  initialDate?: string | null;
  onClose: () => void;
  onConfirm: (rating: number | null, review: string, consumedAt: string | null) => Promise<void> | void;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [review, setReview] = useState(initialReview);
  const [date, setDate] = useState(initialDate ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Que bom que você viu!</p>
        <h2 className="mt-1 text-xl font-bold">{media.title}</h2>

        <label className="mt-5 block text-sm font-medium">Nota (opcional)</label>
        <div className="mt-2">
          <StarsInput value={rating} onChange={setRating} />
        </div>

        <label className="mt-5 block text-sm font-medium" htmlFor="seen-date">
          Quando você viu? (opcional)
        </label>
        <div className="mt-2 flex items-center gap-2">
          {QUICK_DATES.map(({ label, daysAgo }) => {
            const value = localDate(daysAgo);
            return (
              <button
                key={label}
                type="button"
                className={`chip cursor-pointer px-4 py-2 text-sm ${date === value ? "border-accent bg-accent/15 text-accent" : ""}`}
                onClick={() => setDate(date === value ? "" : value)}
              >
                {label}
              </button>
            );
          })}
          <input
            id="seen-date"
            type="date"
            className="input min-w-0 flex-1"
            max={localDate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
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
                await onConfirm(rating, review, date || null);
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
