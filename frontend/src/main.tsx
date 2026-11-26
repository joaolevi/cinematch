import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Imagem de fora que não carrega (o TMDB fora do ar, por exemplo) fica invisível, em vez de mostrar o ícone de imagem
// quebrada; o espaço dela continua. Se a mesma imagem carregar depois, ela volta.
window.addEventListener(
  "error",
  (e) => {
    if (e.target instanceof HTMLImageElement) e.target.dataset.broken = "";
  },
  true,
);
window.addEventListener(
  "load",
  (e) => {
    if (e.target instanceof HTMLImageElement) delete e.target.dataset.broken;
  },
  true,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
