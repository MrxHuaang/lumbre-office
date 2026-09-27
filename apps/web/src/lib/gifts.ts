import "server-only";
// Regalos (fase 5): la lógica está en `gift-service.ts` (sin Next, para poder probarla); este archivo es
// la puerta de las rutas, asegura que nunca llegue al navegador y conecta los avisos reales.
import { publishGiftSent, publishPointsChanged } from "./events";
import type { GiftNotify } from "./gift-service";

export * from "./gift-service";

/** Los avisos al servidor de juego que usan las rutas. */
export const giftNotify: GiftNotify = { pointsChanged: publishPointsChanged, giftSent: publishGiftSent };
