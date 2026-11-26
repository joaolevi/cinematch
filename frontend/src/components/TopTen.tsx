import type { ReactNode } from "react";
import { formatRating, plural } from "../format";
import type { Media, Top } from "../types";
import { TAB_COLORS } from "../ui";
import Carousel from "./Carousel";
import MediaCard from "./MediaCard";

/**
 * O Top 10 do Tastory, pelos registros da comunidade. A posição vai num selo redondo escrito à mão no canto do pôster,
 * como as datas do diário, e o selo de visto ou ouvido aparece como nas outras fileiras.
 */
export default function TopTen({ top, sticker }: { top: Top; sticker: (m: Media) => ReactNode }) {
  return (
    <Carousel label="Queridinhos da semana">
      {top.items.map((item, i) => (
        // O selo da posição fica fora do cartão, no canto de cima à esquerda; o de visto ou ouvido continua à direita
        <div key={item.media.id} className="relative w-36 shrink-0 snap-start pt-3 pl-2 sm:w-40">
          <span
            aria-hidden
            className="absolute top-0 left-0 z-10 grid h-11 w-11 rotate-[-8deg] place-items-center rounded-full font-hand text-2xl leading-none font-bold text-stone-900 shadow-[0_2px_6px_rgb(0_0_0/0.5)]"
            style={{ background: TAB_COLORS[i % TAB_COLORS.length] }}
          >
            {i + 1}º
          </span>
          <MediaCard media={item.media} compact sticker={sticker(item.media)}>
            <p className="text-xs text-muted">
              <span className="sr-only">{i + 1}º lugar · </span>
              {plural(item.count, "registro", "registros")}
              {item.average != null && ` · ★ ${formatRating(item.average)}`}
            </p>
          </MediaCard>
        </div>
      ))}
    </Carousel>
  );
}
