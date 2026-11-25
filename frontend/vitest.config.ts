import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Testes da interface (#18): componentes num DOM simulado, sem servidor. A API é trocada por respostas fixas em cada teste.
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], restoreMocks: true },
});
