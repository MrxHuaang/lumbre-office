// El exterior rediseñado: la casa nueva, naturaleza, lago, huerto e invernadero. Los dibujos están en
// exterior-casa.ts (la casa, que tiene versión de noche y por eso se registra en outdoor.ts),
// exterior-naturaleza.ts y exterior-patio.ts.
import { NATURE_DRAW } from "./exterior-naturaleza";
import { YARD_DRAW } from "./exterior-patio";
import type { Variant } from "./kit";
import type { Sprite } from "./pixel";

/** Dibujos para registrar en DRAW de furniture.ts. */
export const EXTERIOR_DRAW: Record<string, (v: Variant) => Sprite> = {
  ...NATURE_DRAW,
  ...YARD_DRAW,
};
