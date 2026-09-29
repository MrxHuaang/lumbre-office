import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // @pm2/io (dependencia de Colyseus) llama process.send(), que choca con el pool "forks".
    pool: "threads",
    testTimeout: 15_000,
    // Cada archivo levanta un servidor de prueba en el mismo puerto: correrlos en serie.
    fileParallelism: false,
    setupFiles: ["./test/setup.ts"],
  },
});
