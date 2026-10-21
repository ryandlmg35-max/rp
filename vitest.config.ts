import { defineConfig } from "vitest/config";
import path from "node:path";

// Config isolado do Vitest: o vite.config.ts do template traz plugins
// de build/deploy (nitro, tanstackStart) que não rodam em teste.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["teste-*.test.ts"],
  },
});
