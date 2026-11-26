import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Media, Trailer } from "../types";

/**
 * "Ver trailer", como no HBO e na Netflix: o botão só aparece quando o TMDB tem um trailer, e o vídeo abre por cima da
 * página, no modo de privacidade do YouTube. Esc ou o X fecham.
 */
export default function TrailerButton({ media }: { media: Media }) {
  const [trailer, setTrailer] = useState<Trailer | null>(null);
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTrailer(null);
    if (media.type === "album") return;
    api.trailer(media.id).then(setTrailer).catch(() => {});
  }, [media.id, media.type]);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open]);

  if (!trailer) return null;
  return (
    <>
      <button ref={opener} className="btn-ghost" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="currentColor">
          <path d="M6.5 4.5v11l9-5.5z" />
        </svg>
        Ver trailer
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Trailer de ${media.title}`}
          onClick={() => setOpen(false)}
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              ref={close}
              className="absolute -top-11 right-0 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white/10 text-cream hover:bg-white/20"
              aria-label="Fechar o trailer"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
            <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-2xl">
              <iframe
                src={trailer.embed_url}
                title={trailer.name}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
            <p className="mt-2 text-sm text-stone-300">
              {trailer.name}
              {trailer.language === "en" && " · em inglês"} ·{" "}
              <a href={trailer.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
                Abrir no YouTube
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
