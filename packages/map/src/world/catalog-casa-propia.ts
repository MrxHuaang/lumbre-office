// La casa de cada persona (docs/plan-casas.md): las fachadas de la calle del barrio y la cama del cuarto.
// Lo demás del cuarto (la cocinita, la mesita, la lámpara) sale del catálogo de siempre. Dibujos en
// art/casa-propia.ts (la cama) y art/casa-propia-exterior.ts (las fachadas, con versión de noche).
import type { CatalogItem } from "./catalog";

/** El farol de la puerta: la misma luz cálida de los del porche. */
const FAROL = { color: "#ffd98a", radius: 50 };

export const CASA_PROPIA_CATALOG = {
  // Las casitas de la calle, mirando a +y. Solo la de la puerta que se usa (`tuya`) lleva a una casa: su
  // portal es el tile de delante de la puerta. Las otras tres son de adorno.
  "casa-fachada-tuya": { name: "Tu casa", size: [5, 4], fixed: true, hasNight: true, light: { at: [51, 62, 30], ...FAROL } },
  "casa-fachada-estuco": { name: "Casa de estuco", size: [5, 4], fixed: true, hasNight: true, light: { at: [51, 62, 30], ...FAROL } },
  "casa-fachada-ladrillo": { name: "Casa de ladrillo", size: [5, 4], fixed: true, hasNight: true, light: { at: [51, 62, 30], ...FAROL } },
  "casa-fachada-tablas": { name: "Casa de tablas", size: [5, 4], fixed: true, hasNight: true, light: { at: [51, 62, 30], ...FAROL } },
  // La cama sencilla de la casa: la cabecera contra la pared (-x) y la cobija de retazos. Dormir en ella es
  // de otro sub-issue (VIR-144); por ahora es un mueble.
  "casa-cama": { name: "Cama", size: [2, 1] },
} satisfies Record<string, CatalogItem>;
