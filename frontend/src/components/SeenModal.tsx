import { useEffect, useRef, useState, type CSSProperties } from "react";
import { localDate } from "../format";
import type { Media } from "../types";
import { TAB_COLORS, TAPE_COLORS } from "../ui";
import { useFocusTrap } from "../useFocusTrap";
import CloseButton from "./CloseButton";
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
  initialSpoiler = false,
  withSpoiler = false,
  onClose,
  onConfirm,
  onDelete,
}: {
  media: Media;
  initialRating?: number | null;
  initialReview?: string;
  initialDate?: string | null;
  initialSpoiler?: boolean;
  /** Mostra "Tem spoiler" quando há resenha: nas telas que guardam essa marca */
  withSpoiler?: boolean;
  onClose: () => void;
  onConfirm: (rating: number | null, review: string, consumedAt: string | null, spoiler: boolean) => Promise<void> | void;
  /** Só na edição: tira o título do diário */
  onDelete?: () => Promise<void> | void;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [review, setReview] = useState(initialReview);
  const [date, setDate] = useState(initialDate ?? "");
  const [spoiler, setSpoiler] = useState(initialSpoiler);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Uma página do diário: é aqui que a pessoa escreve */}
      <div
        ref={box}
        className="paper relative max-h-[92vh] w-full max-w-md -rotate-[0.6deg] overflow-y-auto rounded-sm py-6 pr-6 pl-14"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="tape -top-2 left-1/2 -translate-x-1/2 rotate-2" style={{ background: TAPE_COLORS[0] }} />
        <CloseButton onClick={onClose} />
        <p className="font-hand text-2xl leading-none font-bold text-[#b9452f]">
          Querido diário, eu {media.type === "album" ? "ouvi" : "vi"}:
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">{media.title}</h2>

        <label className="mt-5 block text-sm font-medium">Minha nota (opcional)</label>
        <div className="mt-2">
          <StarsInput value={rating} onChange={setRating} />
        </div>

        <label className="mt-5 block text-sm font-medium" htmlFor="seen-date">
          Quando eu {media.type === "album" ? "ouvi" : "vi"}? (opcional)
        </label>
        <div className="mt-2 flex items-center gap-3">
          {QUICK_DATES.map(({ label, daysAgo }) => {
            const value = localDate(daysAgo);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={date === value}
                className="tape-chip"
                style={{ "--tape": TAB_COLORS[daysAgo === 0 ? 0 : 2], rotate: `${daysAgo === 0 ? -2 : 1.5}deg` } as CSSProperties}
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
          O que eu achei (opcional)
        </label>
        <textarea
          id="seen-review"
          className="input ruled mt-2 min-h-28 font-hand text-xl! [background-position:0_0.5rem]"
          placeholder="Escreva aqui..."
          value={review}
          maxLength={2000}
          onChange={(e) => setReview(e.target.value)}
        />
        {withSpoiler && review.trim() && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="h-4 w-4 accent-[#b9452f]" />
            Minha resenha conta o que acontece (tem spoiler)
          </label>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {onDelete && (
            <button
              type="button"
              className="mr-auto cursor-pointer text-sm font-bold text-[#b42318] hover:underline"
              onClick={async () => {
                if (confirm(`Remover "${media.title}" do diário?`)) await onDelete();
              }}
            >
              Remover do diário
            </button>
          )}
          <button
            className="btn-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(rating, review, date || null, spoiler && !!review.trim());
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
