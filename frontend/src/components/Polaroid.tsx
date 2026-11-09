import type { CSSProperties, ReactNode } from "react";
import { POLAROID_TILT, TAPE_COLORS } from "../ui";

/**
 * Foto colada no diário: moldura clara, fita e legenda escrita à mão.
 * Regra da identidade: polaroide só para o que é da pessoa (diário, top 10, listas, status no detalhe).
 */
export default function Polaroid({
  position = 0,
  caption,
  small = false,
  tape = true,
  straightenOnHover = true,
  children,
}: {
  position?: number;
  caption?: ReactNode;
  small?: boolean;
  tape?: boolean;
  straightenOnHover?: boolean;
  children: ReactNode;
}) {
  const tilt = POLAROID_TILT[position % POLAROID_TILT.length];
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
