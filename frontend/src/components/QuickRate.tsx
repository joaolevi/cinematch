import { useState } from "react";
import { api } from "../api";
import { formatRating } from "../format";
import { diaryChanged } from "../seen";
import { StarsInput } from "./Stars";

/** Dar nota direto no card, sem abrir o registro (RFF03). A nota continua opcional. */
export default function QuickRate({
  entryId,
  title,
  size = 18,
  onRated,
}: {
  entryId: number;
  title: string;
  size?: number;
  /** Quem passa `onRated` decide quando avisar as outras telas (diaryChanged); sem ele, o aviso é na hora */
  onRated?: (rating: number) => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState(false);

  async function rate(value: number | null) {
    if (value == null) return;
    setRating(value);
    setError(false);
    try {
      await api.updateDiary(entryId, { rating: value });
      if (onRated) onRated(value);
      else diaryChanged();
    } catch {
      setRating(null);
      setError(true);
    }
  }

  return (
    <div aria-label={`Dar nota para ${title}`} role="group">
      <StarsInput value={rating} onChange={rate} size={size} bare />
      <p className="mt-0.5 text-xs text-muted" aria-live="polite">
        {error ? "Não deu para salvar. Tente de novo." : rating != null ? `Nota ${formatRating(rating)} salva` : "Dar nota"}
      </p>
    </div>
  );
}
