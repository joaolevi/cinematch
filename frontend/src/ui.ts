import type React from "react";

/** Grade de pôsteres usada no feed, na busca e no diário. Ocupa a largura toda, até 7 colunas. */
export const MEDIA_GRID =
  "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7";

/** Inclinação e fita de cada polaroide do diário, para não ficarem todas iguais. */
export const POLAROID_TILT = [-2, 1.5, -1, 2, -1.5, 1, -0.5];
export const TAPE_COLORS = ["rgb(242 179 61 / 0.6)", "rgb(232 115 90 / 0.55)", "rgb(127 165 139 / 0.6)"];

/** Cores das abas de fichário, na ordem: âmbar, coral, sálvia, rosa, azul, lilás, areia. */
export const TAB_COLORS = ["#f2b33d", "#e8735a", "#7fa58b", "#e59bb0", "#8fb3c9", "#b39ddb", "#c9b27c"];

/** Estilo de uma aba de fichário (classe `.nb-tab`) com a cor da posição. */
export function tabColor(position: number): React.CSSProperties {
  return { "--tab": TAB_COLORS[position % TAB_COLORS.length] } as React.CSSProperties;
}
