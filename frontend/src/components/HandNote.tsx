import type { ReactNode } from "react";

/** Recado escrito à mão para telas vazias e de espera: "Nada por aqui ainda...". */
export default function HandNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-hand text-2xl leading-8 font-semibold text-stone-300 ${className}`}>{children}</p>;
}
