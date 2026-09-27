import { defineConfig } from "vitest/config";

// Solo los tests de datos puros de la web (sin DOM). Dibujar la escena entera con el motor pixel
// tarda: se da el mismo margen que en packages/map.
export default defineConfig({ test: { include: ["src/**/*.test.ts"], testTimeout: 20_000 } });
