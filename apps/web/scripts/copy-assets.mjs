// Copia los assets del mapa (fuente de verdad en packages/map/assets) a public/assets.
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../../../packages/map/assets/", import.meta.url));
const dest = fileURLToPath(new URL("../public/assets/", import.meta.url));
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("assets del mapa copiados a public/assets");
