// La decoración de la Feria de las flores (ver festival-decor.ts): la plaza de la feria en el pasto al este
// del camino de piedra, a mitad de camino entre el portón y la casa (x 74..96, y 47..55, donde no hay
// árboles): la fila de exhibidores de silletas, la mesa del silletero, el puesto de las semillas, silletas
// de adorno, faroles y un poste de guirnaldas. Sobre el camino, dos arcos de flores, y por el camino baldes
// de flores y faroles hasta el porche; en el recibidor, flores. Todo en tiles del nivel.
import { furnitureTiles } from "../../decor";
import type { AreaDef, Facing, Placement, PointDef } from "../types";
import type { FestivalDecor, FestivalDecorDef } from "../../festival-decor";

/** Los exhibidores de silletas (el mueble); el punto para exhibir y votar va un tile al sur (delante). */
export const SILLETA_STANDS: readonly { x: number; y: number }[] = [77, 80, 83, 86, 89, 92].map((x) => ({ x, y: 48 }));

/** El exhibidor de un punto `silleta_stand` (queda justo al norte del punto). */
export const standOfPoint = (p: { tileX: number; tileY: number }) => ({ x: p.tileX, y: p.tileY - 1 });

/** La mesa del silletero y el puesto de las semillas (sus puntos van delante, al sur). */
export const SILLETERO_TABLE = { x: 76, y: 53 };
export const FLOWER_STALL = { x: 82, y: 53 };

/** Los arcos de flores sobre el camino de piedra (el camino pasa por los tres tiles del medio). */
const ARCOS = [
  { x: 60, y: 53 },
  { x: 60, y: 58 },
];

const put = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });

/**
 * A lo largo del camino de piedra del portón al arco: en cada fila, del lado izquierdo y del derecho, el
 * primer tile de pasto (el camino tiene ancho variable). Baldes de flores de un lado y faroles del otro.
 */
function caminoDecorado(def: AreaDef): Placement[] {
  const out: Placement[] = [];
  // Pasto libre: sin mata, piedra ni nada del plano encima.
  const taken = new Set(def.furniture.flatMap((f) => furnitureTiles(f).map((t) => `${t.x},${t.y}`)));
  const ground = (x: number, y: number) => (taken.has(`${x},${y}`) ? "taken" : (def.ground?.(x, y) ?? "grass"));
  [100, 92, 84, 76, 68, 62].forEach((y, k) => {
    let l = 62;
    while (ground(l, y) === "path" && l > 55) l--;
    let r = 62;
    while (ground(r, y) === "path" && r < 70) r++;
    const [a, b] = k % 2 ? ["feria-lantern", "flower-bucket"] : ["flower-bucket", "feria-lantern"];
    if (ground(l, y) === "grass") out.push(put(a, l, y));
    if (ground(r, y) === "grass") out.push(put(b, r, y));
  });
  return out;
}

function jardin(def: AreaDef): FestivalDecor {
  const furniture: Placement[] = [
    ...ARCOS.map((a) => put("flower-arch", a.x, a.y)),
    // Baldes de flores al pie de cada arco.
    ...ARCOS.flatMap((a) => [put("flower-bucket", a.x - 1, a.y), put("flower-bucket", a.x + 5, a.y)]),
    // La fila de exhibidores de la votación.
    ...SILLETA_STANDS.map((s) => put("silleta-stand", s.x, s.y)),
    // La mesa del silletero, el puesto de las semillas y silletas de adorno entre los dos.
    put("silletero-table", SILLETERO_TABLE.x, SILLETERO_TABLE.y),
    put("flower-bucket", SILLETERO_TABLE.x + 2, SILLETERO_TABLE.y),
    put("silleta-decor", 79, 53),
    put("flower-stall", FLOWER_STALL.x, FLOWER_STALL.y),
    put("flower-bucket", FLOWER_STALL.x + 2, FLOWER_STALL.y),
    put("silleta-decor", 88, 53),
    // Faroles en las cuatro esquinas de la plaza y el poste de guirnaldas en el medio.
    put("feria-lantern", 74, 47),
    put("feria-lantern", 95, 47),
    put("feria-lantern", 74, 55),
    put("feria-lantern", 95, 55),
    put("garland-pole", 84, 51),
    // El camino de piedra y el porche.
    ...caminoDecorado(def),
    put("flower-bucket", 58, 30),
    put("flower-bucket", 67, 30),
  ];
  const points: PointDef[] = [
    ...SILLETA_STANDS.map((s, i): PointDef => ({ type: "silleta_stand", name: `Exhibidor ${i + 1}`, x: s.x, y: s.y + 1 })),
    { type: "silletero_table", name: "Mesa del silletero", x: SILLETERO_TABLE.x, y: SILLETERO_TABLE.y + 1 },
    { type: "feria_shop", name: "Puesto de las flores", x: FLOWER_STALL.x, y: FLOWER_STALL.y + 1 },
  ];
  return { furniture, points };
}

export const FERIA_DECOR: FestivalDecorDef = {
  areas: ["jardin", "planta-baja"],
  build(def) {
    if (def.id === "jardin") return jardin(def);
    // El recibidor huele a jardín: baldes de flores contra la pared (sin tapar el paso).
    if (def.id === "planta-baja") return { furniture: [put("flower-bucket", 18, 18), put("silleta-decor", 18, 19), put("flower-bucket", 18, 20)] };
    return null;
  },
};
