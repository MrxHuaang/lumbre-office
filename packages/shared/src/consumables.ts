// Rediseño: usar lo que se tiene en la mano (F) y los muebles que se usan (E). El servidor valida y
// avisa a los del mismo nivel; cada cliente dibuja la animación.
import { z } from "zod";
import { CASA_CONSUMABLES, CASA_USABLES, type CasaAction } from "./casa";

/**
 * Cómo se consume cada cosa: pitada (cigarro, habano), sorbo (bebidas), mordisco (comida en la mano) o
 * cucharada (lo que viene en plato, taza o vaso: los desayunos, el arroz con leche, el cholado).
 */
export type ConsumeAction = "smoke" | "sip" | "bite" | "spoon";

/**
 * Cada cosa que se puede llevar en la mano (los `holds` de las cartas en cafe.ts): cómo se usa y cuántas
 * veces. Al gastar el último uso desaparece de la mano.
 */
export const CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = {
  tinto: { action: "sip", uses: 3 },
  "cafe-leche": { action: "sip", uses: 4 },
  aromatica: { action: "sip", uses: 4 },
  chocolate: { action: "sip", uses: 4 },
  "coca-cola": { action: "sip", uses: 4 },
  pandebono: { action: "bite", uses: 3 },
  bunuelo: { action: "bite", uses: 3 },
  torta: { action: "bite", uses: 4 },
  cigarro: { action: "smoke", uses: 5 },
  // La carta colombiana de la cafetería: pocillos y vasos se toman a sorbos; lo de comer, a mordiscos
  // (lo más grande rinde más).
  perico: { action: "sip", uses: 3 },
  "cafe-campesino": { action: "sip", uses: 3 },
  "agua-panela-queso": { action: "sip", uses: 4 },
  milo: { action: "sip", uses: 4 },
  "gaseosa-manzana": { action: "sip", uses: 4 },
  "jugo-mora": { action: "sip", uses: 4 },
  "jugo-lulo": { action: "sip", uses: 4 },
  "jugo-maracuya": { action: "sip", uses: 4 },
  "jugo-guanabana": { action: "sip", uses: 4 },
  "jugo-mango": { action: "sip", uses: 4 },
  "limonada-coco": { action: "sip", uses: 5 },
  avena: { action: "sip", uses: 5 },
  kumis: { action: "sip", uses: 3 },
  champus: { action: "sip", uses: 4 },
  salpicon: { action: "sip", uses: 4 },
  "pan-yuca": { action: "bite", uses: 3 },
  almojabana: { action: "bite", uses: 3 },
  roscon: { action: "bite", uses: 4 },
  croissant: { action: "bite", uses: 4 },
  achiras: { action: "bite", uses: 4 },
  empanada: { action: "bite", uses: 3 },
  dedito: { action: "bite", uses: 2 },
  "papa-rellena": { action: "bite", uses: 3 },
  carimanola: { action: "bite", uses: 2 },
  aborrajado: { action: "bite", uses: 3 },
  "arepa-huevo": { action: "bite", uses: 4 },
  "arepa-queso": { action: "bite", uses: 3 },
  "arepa-boyacense": { action: "bite", uses: 3 },
  "arepa-choclo": { action: "bite", uses: 4 },
  "huevos-pericos": { action: "spoon", uses: 4 },
  changua: { action: "spoon", uses: 4 },
  calentado: { action: "spoon", uses: 5 },
  tamal: { action: "bite", uses: 4 },
  cocada: { action: "bite", uses: 2 },
  bocadillo: { action: "bite", uses: 2 },
  natilla: { action: "bite", uses: 3 },
  obleas: { action: "bite", uses: 3 },
  "arroz-con-leche": { action: "spoon", uses: 3 },
  brevas: { action: "bite", uses: 3 },
  cholado: { action: "spoon", uses: 5 },
  merengon: { action: "bite", uses: 4 },
  cerveza: { action: "sip", uses: 5 },
  vino: { action: "sip", uses: 4 },
  coctel: { action: "sip", uses: 4 },
  whisky: { action: "sip", uses: 3 },
  habano: { action: "smoke", uses: 8 },
  // Casa viva: lo gratis de la nevera, la cafetera y la fogata.
  ...CASA_CONSUMABLES,
};

/** Usos de algo en la mano (1 si no está en la tabla: se usa una vez y se va). */
export const usesOf = (art: string) => CONSUMABLES[art]?.uses ?? 1;
export const consumeActionOf = (art: string): ConsumeAction => CONSUMABLES[art]?.action ?? "bite";

export const CONSUME = {
  /** Pausa mínima entre dos usos de la misma persona (dura lo que la animación). */
  cooldownMs: 1600,
} as const;

/** Usos que le quedan a cada mano, como viajan en el estado (`Player.heldLeft`): "4,5". */
export function parseHeldLeft(s: string): number[] {
  if (!s) return [];
  return s.split(",").map((n) => Math.max(0, Number.parseInt(n, 10) || 0));
}
export const formatHeldLeft = (left: readonly number[]) => left.join(",");

/** Cliente → servidor (`MSG.useHeld`): usar lo que tengo en la mano. `part` elige la mano (combos). */
export const UseHeldMessage = z.object({ part: z.number().int().min(0).max(1).optional() }).optional();
export type UseHeldMessage = z.infer<typeof UseHeldMessage>;

/** Servidor → clientes del mismo nivel (`MSG.heldUsed`): alguien usó lo que tenía en una mano. */
export interface HeldUsedEvent {
  sessionId: string;
  /** Mano (0 o 1, en el orden de `holds`). */
  part: number;
  /** Id del dibujo (p. ej. "cigarro"). */
  art: string;
  action: ConsumeAction;
  /** Usos que le quedan a esa mano después de este (0 = se acabó). */
  left: number;
}

// ---------- Muebles que se usan ----------

/**
 * `toggle`: se prende y apaga, y lo ven todos (el estado lo guarda el servidor). `play` (instrumentos) y
 * `pet` (el gato) son un evento: una animación y un sonido para los del mismo nivel.
 */
export type FurnitureAction = "toggle" | "play" | "pet" | CasaAction;

export interface UsableSpec {
  action: FurnitureAction;
  /** Qué dice la ayuda: para `toggle`, cuando está apagado (`label`) y prendido (`labelOn`). */
  label: string;
  labelOn?: string;
  /** Cómo arranca un `toggle` (las lámparas, prendidas; la tele y el tocadiscos, apagados). */
  defaultOn?: boolean;
  /** Pausa mínima entre dos usos de la misma persona. */
  cooldownMs: number;
  /**
   * Lámparas sin capa de encendida: de día prenderlas no cambia nada visible, así que la ayuda solo se
   * ofrece de noche (el servidor igual acepta el cambio).
   */
  nightOnly?: boolean;
  /** Casa viva (`take`, `roast`): lo que puede quedar en la mano (el servidor elige con la semilla). */
  gives?: readonly string[];
  /** Alcance propio en tiles (la fogata se usa desde los troncos); si no, INTERACT_REACH_TILES. */
  reachTiles?: number;
  /**
   * `false`: sin destello de "aquí se puede hacer algo" (plantas, estanterías, lavamanos, cortinas): son
   * tantos que el indicador quedaría titilando sobre casi cada mueble. Ver `usableMarker` en casa.ts.
   */
  marker?: false;
}

export const USABLE_FURNITURE: Record<string, UsableSpec> = {
  piano: { action: "play", label: "Tocar el piano", cooldownMs: 2600 },
  guitar: { action: "play", label: "Tocar la guitarra", cooldownMs: 2600 },
  "record-player": { action: "toggle", label: "Poner un disco", labelOn: "Quitar el disco", defaultOn: false, cooldownMs: 800 },
  "tv-retro": { action: "toggle", label: "Prender la tele", labelOn: "Apagar la tele", defaultOn: false, cooldownMs: 600 },
  lamp: { action: "toggle", label: "Prender la lámpara", labelOn: "Apagar la lámpara", defaultOn: true, cooldownMs: 400 },
  "lamp-mushroom": { action: "toggle", label: "Prender la lámpara", labelOn: "Apagar la lámpara", defaultOn: true, cooldownMs: 400, nightOnly: true },
  // La de lectura de los interiores nuevos (catalog-interior.ts): sin capa propia, solo su luz de noche.
  "reading-lamp": { action: "toggle", label: "Prender la lámpara", labelOn: "Apagar la lámpara", defaultOn: true, cooldownMs: 400, nightOnly: true },
  "cat-bed": { action: "pet", label: "Acariciar al gato", cooldownMs: 1500 },
  // Casa viva (casa.ts): lámparas, libros, nevera, cafetera, radio, globo, chimeneas, plantas, cortinas,
  // juegos de mesa, pizarras, baños y la fogata.
  ...CASA_USABLES,
};

export const usableSpec = (type: string): UsableSpec | undefined => USABLE_FURNITURE[type];

/** Clave de un mueble en el estado (`OfficeState.switches`): nivel, tipo y esquina en tiles. */
export const furnitureKey = (area: string, type: string, x: number, y: number) => `${area}:${type}:${x},${y}`;

/** ¿Está prendido? Lo que no está en `switches` sigue como arranca (`defaultOn`). */
export function isSwitchedOn(switches: { get(key: string): boolean | undefined }, area: string, type: string, x: number, y: number) {
  return switches.get(furnitureKey(area, type, x, y)) ?? usableSpec(type)?.defaultOn ?? false;
}

/** Lo mínimo de un nivel para saber dónde hay paredes (lo cumple `OfficeMap` de @hyvento/map). */
export interface WallGrid {
  width: number;
  height: number;
  /** Pared en el borde superior de cada tile: índice `y * width + x`, con y de 0 a height. */
  wallH: ArrayLike<number>;
  /** Pared en el borde izquierdo de cada tile: índice `y * (width + 1) + x`, con x de 0 a width. */
  wallV: ArrayLike<number>;
}

/** Pasos máximos (tile a tile, sin cruzar paredes) para usar un mueble: a la vuelta de una pared no se llega. */
export const USE_STEPS = 3;

/**
 * Pasos de tile a tile desde (tx, ty) hasta el rectángulo del mueble sin cruzar paredes, o Infinity si
 * hacen falta más de `max`. Los muebles no estorban (se estira el brazo por encima): lo que separa dos
 * salas es la pared, aunque sea baja. Sirve para usar muebles y para ver hasta dónde se oye la música.
 */
export function stepsTo(g: WallGrid, tx: number, ty: number, f: { x: number; y: number; w: number; d: number }, max: number): number {
  const inside = (x: number, y: number) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d;
  if (tx < 0 || ty < 0 || tx >= g.width || ty >= g.height) return Infinity;
  if (inside(tx, ty)) return 0;
  const seen = new Set<number>([ty * g.width + tx]);
  let frontier: [number, number][] = [[tx, ty]];
  for (let steps = 1; steps <= max && frontier.length > 0; steps++) {
    const next: [number, number][] = [];
    for (const [x, y] of frontier) {
      // Arriba, abajo, izquierda y derecha, si no hay pared en ese borde.
      const moves: [number, number, boolean][] = [
        [x, y - 1, !g.wallH[y * g.width + x]],
        [x, y + 1, !g.wallH[(y + 1) * g.width + x]],
        [x - 1, y, !g.wallV[y * (g.width + 1) + x]],
        [x + 1, y, !g.wallV[y * (g.width + 1) + x + 1]],
      ];
      for (const [nx, ny, open] of moves) {
        if (!open || nx < 0 || ny < 0 || nx >= g.width || ny >= g.height || seen.has(ny * g.width + nx)) continue;
        if (inside(nx, ny)) return steps;
        seen.add(ny * g.width + nx);
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** Cliente → servidor (`MSG.furnitureUse`): usar el mueble de ese tipo con esquina en (x, y) de mi nivel. */
export const FurnitureUseMessage = z.object({
  type: z.string().min(1).max(40),
  x: z.number().int().min(0).max(255),
  y: z.number().int().min(0).max(255),
});
export type FurnitureUseMessage = z.infer<typeof FurnitureUseMessage>;

/** Servidor → clientes del mismo nivel (`MSG.furnitureEvent`): alguien tocó un instrumento o acarició al gato. */
export interface FurnitureEvent {
  sessionId: string;
  type: string;
  x: number;
  y: number;
  action: Exclude<FurnitureAction, "toggle">;
  /** Semilla de la melodía: todos oyen las mismas notas. */
  seed: number;
  /** Casa viva: lo que salió de la nevera o la cafetera (o el malvavisco que se está asando). */
  item?: string;
  /** Casa viva: el valor nuevo del contador (ajedrez, puzle, pizarra), para mostrarlo sin esperar al estado. */
  count?: number;
}
