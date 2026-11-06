import { genreStyle } from "../lib/visual";

export default function GenreChip({
  genre,
  active,
  onClick,
}: {
  genre: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const base = `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${genreStyle(genre)}`;
  if (!onClick) return <span className={base}>{genre}</span>;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${base} cursor-pointer px-3 py-1 transition ${
        active ? "ring-2 ring-accent" : "opacity-60 hover:opacity-100"
      }`}
    >
      {genre}
    </button>
  );
}
