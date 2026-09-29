import { defineConfig, devices } from "@playwright/test";

// Smoke de punta a punta: la web en `next dev` (el ingreso de prueba solo existe fuera de producción) y
// el servidor de juego, contra una base local con las migraciones aplicadas. Los puertos se eligen por
// variable para no chocar con un `pnpm dev` abierto (3000/2567): por defecto 3100 y 2667.
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
const GAME_PORT = Number(process.env.E2E_GAME_PORT ?? 2667);
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
// Secreto de mentira para firmar el token de juego (web y servidor tienen que usar el mismo).
const GAME_TOKEN_SECRET = process.env.GAME_TOKEN_SECRET ?? "e2e-secreto-de-prueba-e2e-secreto-de-prueba";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL)) {
  throw new Error("El smoke necesita E2E_DATABASE_URL (o DATABASE_URL) apuntando a un Postgres local con las migraciones aplicadas.");
}

const env = {
  ...(process.env as Record<string, string>),
  DATABASE_URL,
  GAME_TOKEN_SECRET,
  NEXT_PUBLIC_GAME_SERVER_URL: `ws://localhost:${GAME_PORT}`,
  GAME_SERVER_HTTP_URL: `http://localhost:${GAME_PORT}`,
  // Sin Supabase: solo el ingreso de prueba.
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  // `next dev` compila la cabaña la primera vez: en el CI tarda.
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      // El servidor de juego (mismo arranque que `pnpm --filter @hyvento/server start`).
      command: "node ./node_modules/tsx/dist/cli.mjs src/index.ts",
      cwd: "../server",
      url: `http://localhost:${GAME_PORT}/health`,
      env: { ...env, PORT: String(GAME_PORT), GAME_SERVER_PORT: String(GAME_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
    },
    {
      command: `node ./node_modules/next/dist/bin/next dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      env: { ...env, PORT: String(WEB_PORT) },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
