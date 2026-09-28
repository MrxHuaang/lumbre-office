import { defineConfig } from "vitest/config";

// Los tests del arte dibujan miles de sprites (cada prenda con cada peinado y conjunto) y niveles
// enteros: con la máquina cargada (o en un CI lento) pasan los 5 s por defecto sin que haya un error de verdad.
export default defineConfig({ test: { testTimeout: 90_000 } });
