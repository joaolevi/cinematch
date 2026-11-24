import { useEffect, useState } from "react";
import { api } from "./api";
import type { Mood } from "./types";

/** O vocabulário de climas (RNFF09), buscado uma vez e guardado enquanto a página estiver aberta. */
let cache: Promise<Mood[]> | null = null;

export function useMoods(): Mood[] {
  const [moods, setMoods] = useState<Mood[]>([]);
  useEffect(() => {
    cache ??= api.moods().catch(() => {
      cache = null;
      return [];
    });
    cache.then(setMoods);
  }, []);
  return moods;
}

export function moodLabel(moods: Mood[], key: string): string {
  return moods.find((m) => m.key === key)?.label ?? key;
}
