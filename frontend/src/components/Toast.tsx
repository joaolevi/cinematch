import type { ReactNode } from "react";

/** Aviso rápido, num post-it colado no pé da tela. */
export default function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="toast-note fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 -rotate-1 items-center gap-3 px-5 py-3 text-sm font-semibold"
    >
      {children}
    </div>
  );
}
