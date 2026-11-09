import { colorFor } from "../format";

/** Gênero com cor própria, sempre a mesma em todo o sistema. */
export default function GenreChip({ genre, small = false }: { genre: string; small?: boolean }) {
  const color = colorFor(genre);
  return (
    <span
      className={`chip ${small ? "px-2 py-0.5 text-[11px]" : ""}`}
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}14` }}
    >
      {genre}
    </span>
  );
}
