import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../api";
import type { Media } from "../types";
import Polaroid from "./Polaroid";
import Poster from "./Poster";

// Cada foto cobre só uma faixa estreita da anterior, para nenhum título ficar escondido
const LEFT = [0, 24, 48, 72];
const TOP = [6, 0, 9, 3];
const CAPTIONS = ["3 de nov.", "5 de nov.", "6 de nov.", "8 de nov."];

/**
 * Página de diário de exemplo, com pôsteres reais do que está em alta (a rota é pública).
 * Usada na apresentação e no login, para quem ainda não entrou ver como o diário fica.
 */
export default function PolaroidCollage({
  count = 4,
  withAlbum = false,
  children,
}: {
  count?: number;
  withAlbum?: boolean; // um disco no lugar do terceiro pôster: o diário também é de música
  children?: ReactNode;
}) {
  const [posters, setPosters] = useState<Media[]>([]);

  useEffect(() => {
    Promise.all([api.trending(undefined, 16), withAlbum ? api.showcase().catch(() => null) : Promise.resolve(null)])
      .then(([items, showcase]) => {
        const videos = items.filter((m) => m.poster_url).slice(0, count);
        const album = showcase?.albums.find((m) => m.poster_url);
        if (album && videos.length >= 3) videos.splice(2, 1, album);
        setPosters(videos);
      })
      .catch(() => {});
  }, [count, withAlbum]);

  const step = count > 1 ? 72 / (count - 1) : 0;
  return (
    <div className="relative aspect-[16/10] w-full" aria-hidden>
      {posters.map((media, position) => (
        <div
          key={media.id}
          className="absolute w-[25%]"
          style={
            {
              left: `${count === 4 ? LEFT[position] : position * step}%`,
              top: `${TOP[position % TOP.length]}%`,
              zIndex: position,
            } as CSSProperties
          }
        >
          <Polaroid
            position={position}
            caption={media.type === "album" ? undefined : CAPTIONS[position % CAPTIONS.length]}
            straightenOnHover={false}
            album={media.type === "album"}
          >
            <Poster media={media} rounded="rounded-[2px]" />
          </Polaroid>
        </div>
      ))}
      {children}
    </div>
  );
}
