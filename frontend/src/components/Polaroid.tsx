import type { CSSProperties, ReactNode } from "react";
import { POLAROID_TILT, TAB_COLORS, TAPE_COLORS } from "../ui";

/**
 * Foto colada no diário: moldura clara, fita e legenda escrita à mão.
 * Regra da identidade: polaroide só para o que é da pessoa (diário, top 10, listas, status no detalhe).
 * Disco não vira foto: com `album`, a capa é colada direto com fita, o vinil sai por baixo e a legenda vai num selo
 * redondo, como as etiquetas das lojas de discos.
 */
export default function Polaroid({
  position = 0,
  caption,
  small = false,
  tape = true,
  straightenOnHover = true,
  album = false,
  children,
}: {
  position?: number;
  caption?: ReactNode;
  small?: boolean;
  tape?: boolean;
  straightenOnHover?: boolean;
  album?: boolean;
  children: ReactNode;
}) {
  const tilt = POLAROID_TILT[position % POLAROID_TILT.length];
  if (album) {
    return (
      <div
        className={`@container relative transition [rotate:var(--tilt)] ${straightenOnHover ? "group-hover:[rotate:0deg]" : ""} ${small ? "pb-1" : "pb-4"}`}
        style={{ "--tilt": `${tilt}deg` } as CSSProperties}
      >
        {tape && (
          <span
            aria-hidden
            className={`tape left-1/2 -translate-x-1/2 -rotate-3 ${small ? "-top-1.5 h-3! w-8!" : "-top-2"}`}
            style={{ background: TAPE_COLORS[position % TAPE_COLORS.length] }}
          />
        )}
        {children}
        {caption != null && (
          // O selo cresce com o disco (um terço da largura). Fica no canto de baixo da capa, que é quadrada e ocupa os dois terços de cima
          <span
            className={`absolute top-[66.7%] right-0 z-[3] flex aspect-square -translate-y-[70%] translate-x-[18%] rotate-[-8deg] items-center justify-center rounded-full text-center font-hand leading-none font-bold text-stone-900 shadow-[0_2px_5px_rgb(0_0_0/0.45)] w-[32%] p-[3%] text-[clamp(0.6rem,10cqw,1rem)]`}
            style={{ background: TAB_COLORS[position % TAB_COLORS.length] }}
          >
            <span className="w-full break-words">{caption}</span>
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      className={`polaroid transition [rotate:var(--tilt)] ${straightenOnHover ? "group-hover:[rotate:0deg]" : ""} ${small ? "polaroid-small" : ""}`}
      style={{ "--tilt": `${tilt}deg` } as CSSProperties}
    >
      {tape && (
        <span
          aria-hidden
          className={`tape left-1/2 -translate-x-1/2 -rotate-3 ${small ? "-top-1.5 h-3! w-8!" : "-top-2"}`}
          style={{ background: TAPE_COLORS[position % TAPE_COLORS.length] }}
        />
      )}
      {children}
      {caption != null ? (
        <p
          className={`truncate text-center font-hand leading-6 font-bold text-stone-800 ${small ? "py-0.5 text-base" : "py-1 text-xl"}`}
        >
          {caption}
        </p>
      ) : (
        <div className={small ? "h-2" : "h-5"} />
      )}
    </div>
  );
}
