import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// Endereço público do site, para a prévia de links (og:image precisa de URL completa)
function linkPreview(publicUrl: string): Plugin {
  return {
    name: "link-preview",
    transformIndexHtml: (html) => html.replaceAll("__PUBLIC_URL__", publicUrl.replace(/\/$/, "")),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), linkPreview(loadEnv(mode, ".", "VITE_").VITE_PUBLIC_URL ?? "")],
  server: { port: 5173 },
}));
