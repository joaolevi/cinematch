import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Porta 5173 já está liberada no CORS da API por padrão.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
