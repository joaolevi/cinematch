import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import type { DiaryEntry } from "./types";

/** O diário de quem está logado, por título. Serve para mostrar o selo "Visto" fora do diário. */
type Seen = Map<number, DiaryEntry>;

let owner: number | null = null; // de quem é o diário guardado em `seen`
let loadingFor: number | null = null;
let seen: Seen | null = null;
let version = 0; // muda a cada registro novo, editado ou apagado
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load(userId: number) {
  loadingFor = userId;
  try {
    const entries = await api.diary();
    if (loadingFor !== userId) return; // outra pessoa entrou enquanto carregava
    owner = userId;
    seen = new Map(entries.map((entry) => [entry.media.id, entry]));
    emit();
  } catch {
    // Sem o selo, as telas continuam funcionando; a próxima tela tenta de novo
  } finally {
    if (loadingFor === userId) loadingFor = null;
  }
}

/** Chamado ao entrar e ao sair: o diário guardado é de outra pessoa. */
export function resetSeen() {
  owner = null;
  loadingFor = null;
  seen = null;
  version++;
  emit();
}

export function useSeen(userId: number | undefined): Seen | null {
  const snapshot = useSyncExternalStore(subscribe, () => (userId != null && owner === userId ? seen : null));
  useEffect(() => {
    if (userId == null || owner === userId || loadingFor === userId) return;
    load(userId);
  }, [userId]);
  return snapshot;
}

/** Avise sempre que o diário mudar: o selo e a página do diário se atualizam. */
export function diaryChanged() {
  version++;
  emit();
  if (owner != null && loadingFor == null) load(owner);
}

export function useDiaryVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}
