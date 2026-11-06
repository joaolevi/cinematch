import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Fileira que rola para os lados: com as setas no computador e com o dedo no celular. */
export default function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const update = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setCanGoBack(el.scrollLeft > 4);
    setCanGoForward(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, children]);

  const move = (direction: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrow = "btn-ghost absolute top-1/3 z-10 hidden h-10 w-10 rounded-full bg-bg/90 p-0 text-lg sm:inline-flex";

  return (
    <div className="relative">
      {canGoBack && (
        <button className={`${arrow} -left-3`} aria-label={`Voltar em ${label}`} onClick={() => move(-1)}>
          ‹
        </button>
      )}
      <div
        ref={row}
        onScroll={update}
        className="flex snap-x gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {canGoForward && (
        <button className={`${arrow} -right-3`} aria-label={`Avançar em ${label}`} onClick={() => move(1)}>
          ›
        </button>
      )}
    </div>
  );
}
