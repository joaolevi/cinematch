import { useEffect } from "react";

/** Nome da aba do navegador, por exemplo "Meu diário | Tastory". */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} | Tastory` : "Tastory";
  }, [title]);
}
