import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // @pm2/io (dependencia de Colyseus) llama process.send(), que choca con el pool "forks".
    pool: "threads",
    testTimeout: 15_000,
  },
});
