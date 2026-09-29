import { CASA_PROPIA } from "@hyvento/shared";
import type { AreaDef, FloorKind, Placement } from "../types";
import { place } from "./place";
import { CONEXIONES } from "./conexiones";

// ---------- Barrio ----------
// La calle de las casas (docs/plan-casas.md): una cuadra corta con cuatro casitas del mismo lado, sus
// antejardines con el buzón y la vereda de piedra con faroles. Solo la puerta de la tercera ("Tu casa")
// se usa: lleva a la casa de quien la cruza (el servidor cambia el destino `casa:@` por `casa:<userId>`,
// ver CASA_PROPIA en @hyvento/shared). Las otras son de adorno. Al sur de la vereda queda el pasto donde
// va a parar el Megabús (VIR-142). Como el jardín, tiene un margen de bosque que se dibuja pero no se pisa.
// Todo lo de abajo está en coordenadas de la zona jugable y se corre en M al ubicarlo en el nivel.

const M = 6;
const PW = 26;
const PH = 11;
const W = PW + M * 2;
const H = PH + M * 2;

/** Las fachadas (5x4), de oeste a este; la tercera es la tuya. */
const FACHADAS = [
  { type: "casa-fachada-estuco", x: 1 },
  { type: "casa-fachada-ladrillo", x: 7 },
  { type: "casa-fachada-tuya", x: 13 },
  { type: "casa-fachada-tablas", x: 19 },
] as const;
const FACHADA_D = 4;
/** La puerta queda en la tercera columna de cada fachada. */
const PUERTA_DX = 2;
/** Filas: los antejardines empiezan delante de las fachadas; la vereda y el pasto del bus más abajo. */
const JARDINES_Y = FACHADA_D;
const VEREDA_Y = 7;
const PASTO_Y = 9;

const TUYA = FACHADAS.find((f) => f.type === "casa-fachada-tuya")!;
if (TUYA.x + M + PUERTA_DX !== CONEXIONES.barrio.casa.tiles[0]!.x || JARDINES_Y + M !== CONEXIONES.barrio.casa.tiles[0]!.y)
  throw new Error("la puerta del barrio de conexiones.ts no está delante de la fachada de tu casa");

/** Piso de la zona jugable: la vereda, el senderito de cada puerta y pasto en lo demás. */
function localGround(x: number, y: number): FloorKind {
  if (x < 0 || y < 0 || x >= PW || y >= PH) return "forest";
  if (y >= VEREDA_Y && y < PASTO_Y) return "path";
  if (y >= JARDINES_Y && y < VEREDA_Y && FACHADAS.some((f) => x === f.x + PUERTA_DX)) return "path";
  return "grass";
}

const items: Placement[] = [];
const put = (type: string, x: number, y: number, facing: Placement["facing"] = "right") => items.push(place(type, x + M, y + M, facing));

for (const f of FACHADAS) {
  put(f.type, f.x, 0);
  // El buzón de cada casa, al lado del senderito, y un cantero del otro lado.
  put("mailbox", f.x + PUERTA_DX + 1, JARDINES_Y + 1);
  put("flowerbed", f.x + PUERTA_DX - 1, JARDINES_Y + 1);
}
// Los faroles, en el pasto al borde de la vereda (no sobre la piedra), una banca mirando a la calle, el
// barril de agua de lluvia de la casa de estuco y matas en las puntas.
for (const x of [0, 6, 12, 18, 25]) put("lamp-post", x, PASTO_Y);
put("bench", 9, PASTO_Y, "down");
put("water-barrel", 5, JARDINES_Y);
put("bush-round", 25, JARDINES_Y);
put("bush-hydrangea", 0, JARDINES_Y);
put("oak-2", 25, 0);
put("pine-1", 0, PASTO_Y + 1);
put("birch-1", 24, PASTO_Y + 1);

export const barrio: AreaDef = {
  id: CASA_PROPIA.street,
  name: "Barrio",
  width: W,
  height: H,
  outdoor: true,
  playable: { x: M, y: M, w: PW, h: PH },
  surroundings: "forest",
  ground: (x, y) => localGround(Math.floor(x) - M, Math.floor(y) - M),
  groundFine: (x, y) => localGround(Math.floor(x) - M, Math.floor(y) - M),
  rooms: [],
  doors: [],
  zones: [{ id: CASA_PROPIA.street, name: "Barrio", type: "common", rect: { x: 0, y: 0, w: W, h: H }, isolated: false }],
  features: [],
  furniture: items,
  portals: [
    {
      id: CASA_PROPIA.portal,
      label: "Entrar a tu casa",
      tiles: CONEXIONES.barrio.casa.tiles,
      // "La casa de quien entra": el servidor lo resuelve a `casa:<userId>` (ver handleTravel).
      to: { area: CASA_PROPIA.own, ...CONEXIONES.casaPropia.puerta.llegada },
    },
  ],
  points: [{ type: "spawn", name: "Barrio", x: 13 + M, y: VEREDA_Y + M }],
};
