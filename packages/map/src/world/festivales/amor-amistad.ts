// La decoración de Amor y amistad (ver festival-decor.ts): la plaza del amor en el pasto al este del camino
// de piedra (x 74..96, y 47..56, la misma pradera de la feria): el cofre del amigo secreto, el puesto de
// chocolates y flores, la banca de los enamorados con sus globos, el sitio del trío de la serenata, dos
// guirnaldas de corazones y faroles rosados en las esquinas. En la salida del patio, el arco de flores; por
// el camino de piedra, faroles rosados y globos hasta el porche; en el recibidor, globos. Tiles del nivel.
import { TRIO_TILES } from "@hyvento/shared";
import { furnitureTiles } from "../../decor";
import type { AreaDef, Facing, Placement, PointDef } from "../types";
import type { FestivalDecor, FestivalDecorDef } from "../../festival-decor";

/** El cofre del amigo secreto (el punto va delante, al sur). */
export const AMIGO_COFRE = { x: 79, y: 51 };
/** El puesto de chocolates y flores (Doña Rubiela atiende detrás; el punto, delante). */
export const PUESTO_AMOR = { x: 84, y: 50 };
/** La banca de los enamorados (dos puestos mirando al sur): ahí la foto sale con marco de corazones. */
export const BANCA_ENAMORADOS = { x: 91, y: 50 };
/** El arco de flores sobre el senderito que sale del patio hacia el sur (se pasa por los tres del medio). */
export const ARCO_PATIO = { x: 84, y: 31 };

const put = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });

/** Faroles rosados y globos de corazón a lado y lado del camino de piedra, del portón al porche. */
function caminoDecorado(def: AreaDef): Placement[] {
  const out: Placement[] = [];
  const taken = new Set(def.furniture.flatMap((f) => furnitureTiles(f).map((t) => `${t.x},${t.y}`)));
  const ground = (x: number, y: number) => (taken.has(`${x},${y}`) ? "taken" : (def.ground?.(x, y) ?? "grass"));
  [96, 88, 80, 72, 64, 56, 48, 40].forEach((y, k) => {
    let l = 62;
    while (ground(l, y) === "path" && l > 55) l--;
    let r = 62;
    while (ground(r, y) === "path" && r < 70) r++;
    const [a, b] = k % 2 ? ["farol-rosado", "globos-corazon"] : ["globos-corazon", "farol-rosado"];
    if (ground(l, y) === "grass") out.push(put(a, l, y));
    if (ground(r, y) === "grass") out.push(put(b, r, y));
  });
  return out;
}

function jardin(def: AreaDef): FestivalDecor {
  const furniture: Placement[] = [
    put("arco-corazones", ARCO_PATIO.x, ARCO_PATIO.y),
    put("amigo-cofre", AMIGO_COFRE.x, AMIGO_COFRE.y),
    put("puesto-amor", PUESTO_AMOR.x, PUESTO_AMOR.y),
    put("banca-enamorados", BANCA_ENAMORADOS.x, BANCA_ENAMORADOS.y),
    put("globos-corazon", BANCA_ENAMORADOS.x - 2, BANCA_ENAMORADOS.y),
    put("globos-corazon", BANCA_ENAMORADOS.x + 2, BANCA_ENAMORADOS.y),
    put("globos-corazon", AMIGO_COFRE.x - 2, AMIGO_COFRE.y - 1),
    put("guirnalda-corazones", 83, 48),
    put("guirnalda-corazones", 91, 48),
    put("farol-rosado", 74, 48),
    put("farol-rosado", 96, 48),
    put("farol-rosado", 74, 54),
    put("farol-rosado", 96, 54),
    ...caminoDecorado(def),
    put("globos-corazon", 58, 30),
    put("globos-corazon", 67, 30),
  ];
  const trio = TRIO_TILES[1]!;
  const points: PointDef[] = [
    { type: "amigo_secreto", name: "Cofre del amigo secreto", x: AMIGO_COFRE.x, y: AMIGO_COFRE.y + 1 },
    { type: "festival_shop", name: "Puesto de chocolates y flores", x: PUESTO_AMOR.x, y: PUESTO_AMOR.y + 1 },
    { type: "amor_serenata", name: "Serenata", x: trio.x, y: trio.y + 1 },
  ];
  return { furniture, points };
}

export const AMOR_DECOR: FestivalDecorDef = {
  areas: ["jardin", "planta-baja"],
  build(def) {
    if (def.id === "jardin") return jardin(def);
    // El recibidor: globos de corazón contra la pared (sin tapar el paso).
    if (def.id === "planta-baja") return { furniture: [put("globos-corazon", 18, 18), put("globos-corazon", 18, 20)] };
    return null;
  },
};
