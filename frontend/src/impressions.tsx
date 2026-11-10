import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { api } from "./api";
import type { Recommendation } from "./types";

const VISIBLE_SHARE = 0.5;
// Padrão de mercado para "anúncio visto" (IAB): metade do card na tela por 1 segundo seguido.
// Quem rola o feed rápido não conta como tendo visto os cards que passaram.
const VISIBLE_FOR_MS = 1000;
const SEND_AFTER_MS = 1000;

/** Junta os títulos que apareceram na tela e avisa a API: é isso que conta como exibido. */
export function useImpressions() {
  const reported = useRef(new Set<number>());
  const queue = useRef<Recommendation[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const batch = queue.current;
    queue.current = [];
    if (batch.length === 0) return;
    await api.impressions(batch).catch(() => {
      queue.current.push(...batch); // vai junto no próximo envio
    });
  }, []);

  const mark = useCallback(
    (rec: Recommendation) => {
      if (reported.current.has(rec.media.id)) return;
      reported.current.add(rec.media.id);
      queue.current.push(rec);
      timer.current ??= setTimeout(send, SEND_AFTER_MS);
    },
    [send],
  );

  useEffect(() => () => void send(), [send]);

  return { mark, send };
}

/** Avisa quando pelo menos metade do card fica na tela por 1 segundo seguido. */
export function OnScreen({
  rec,
  onSeen,
  children,
}: {
  rec: Recommendation;
  onSeen: (rec: Recommendation) => void;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!card.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer ??= setTimeout(() => {
            onSeen(rec);
            observer.disconnect();
          }, VISIBLE_FOR_MS);
        } else if (timer) {
          clearTimeout(timer); // saiu da tela antes de 1 s: começa de novo quando voltar
          timer = null;
        }
      },
      { threshold: VISIBLE_SHARE },
    );
    observer.observe(card.current);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [rec, onSeen]);

  return (
    <div ref={card} className="flex flex-col">
      {children}
    </div>
  );
}
