import { useEffect, useState } from "react";
import { API_URL, api } from "./api";

// As fotos de perfil que a pessoa pode ver, pedidas uma vez: id -> código da foto (o código muda a cada troca)
let codes: Record<string, string> | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Pede de novo a lista de fotos: depois de trocar ou tirar a própria foto. */
export function refreshAvatars(): Promise<void> {
  pending = api
    .avatars()
    .then((found) => {
      codes = found;
      listeners.forEach((l) => l());
    })
    .catch(() => {});
  return pending;
}

/** O endereço da foto de uma pessoa, ou null para mostrar a inicial do nome. */
export function useAvatarUrl(userId?: number): string | null {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (userId == null) return;
    const listener = () => redraw((n) => n + 1);
    listeners.add(listener);
    if (!codes && !pending) refreshAvatars();
    return () => {
      listeners.delete(listener);
    };
  }, [userId]);
  const code = userId != null ? codes?.[String(userId)] : undefined;
  return code ? `${API_URL}/users/${userId}/avatar/${code}` : null;
}

/** Ao sair da conta, a lista é de outra pessoa: esquece. */
export function forgetAvatars() {
  codes = null;
  pending = null;
}
