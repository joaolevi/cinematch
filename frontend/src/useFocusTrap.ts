import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Mantém o foco dentro de uma janela aberta: Tab e Shift+Tab giram só entre os controles dela,
 * e, ao fechar, o foco volta para onde estava (o botão que abriu a janela).
 */
export function useFocusTrap(box: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const before = document.activeElement as HTMLElement | null;
    const el = box.current;
    // Ao abrir, o foco vai para a própria janela, e não para um botão: um Enter ainda pressionado
    // (como o que escolheu o título no Registrar) acionaria esse botão e fecharia a janela na hora
    if (el && !el.contains(document.activeElement)) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((i) => i.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !box.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [box, active]);
}
