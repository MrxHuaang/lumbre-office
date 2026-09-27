// Dibuja el banner del README (docs/img/lumbre-banner.svg) con la misma llamita y letras pixel de la
// marca. Se corre a mano si cambia la marca: pnpm --filter @hyvento/web banner
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bannerSvg } from "../src/components/lumbre/marca";

const destino = fileURLToPath(new URL("../../../docs/img/lumbre-banner.svg", import.meta.url));
writeFileSync(destino, `${bannerSvg()}\n`);
console.log(`Banner escrito en ${destino}`);
