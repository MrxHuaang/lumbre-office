// Mundo lleno: los muebles que antes eran solo de adorno y ahora hacen algo. Se usan como el resto de los
// muebles (E o clic, `MSG.furnitureUse`, mismas reglas de alcance) y se suman a USABLE_FURNITURE
// (consumables.ts). Lo que da algo o cambia el estado lo decide el servidor (apps/server/src/rooms/mundo.ts);
// los paneles (tragamonedas, garra, rueda, telescopios) se abren cuando el servidor acepta el uso.
import { z } from "zod";
import type { ConsumeAction, UsableSpec } from "./consumables";
import { pickLine, spokenHour } from "./npcs";
import { isNightMinute } from "./clock";
import type { Season } from "./estaciones";
import type { Weather } from "./weather";

/**
 * Lo nuevo que se hace con un mueble:
 * - `panel`: abre un panel del navegador (tragamonedas, garra, estante de premios, rueda, telescopio, pizarra);
 * - `print`: la impresora saca tu nota más reciente como una hoja para la mochila;
 * - `shower`: la ducha del jardín (se enjuaga y queda seco);
 * - `doghouse`: la casita del perro (tu mascota descansa o juega ahí);
 * - `bowl`: el comedero de la casa propia (tu mascota va a comer);
 * - `sundial`: el reloj de sol dice la hora del juego (de día);
 * - `view`: la baranda del balcón o de la terraza: mirar el paisaje.
 */
export type MundoAction = "panel" | "print" | "shower" | "doghouse" | "bowl" | "sundial" | "view";
export const MUNDO_ACTIONS: readonly MundoAction[] = ["panel", "print", "shower", "doghouse", "bowl", "sundial", "view"];
export const isMundoAction = (a: string): a is MundoAction => (MUNDO_ACTIONS as readonly string[]).includes(a);

/** Los paneles que abre un mueble (`panel`). */
export type MundoPanel = "slots" | "claw" | "prizes" | "fortune" | "telescope" | "whiteboard";

/** Tipo de la pizarra de la pared (no es un mueble del catálogo: sale de las paredes, ver `wallBoardsOf`). */
export const WALL_BOARD_TYPE = "pizarra-pared";

/** Telescopios de adorno (terraza del piso 3, casa del árbol, placita del observatorio): de noche, el cielo. */
export const DECOR_SCOPES: readonly string[] = ["telescope", "stargazer-scope"];

export const MUNDO = {
  /** Cuánto dura la ducha (las gotas) antes de quedar seco. */
  showerMs: 2_600,
  /** Pausa entre dos impresiones de la misma persona (la impresora es lenta). */
  printCooldownMs: 20_000,
  /** Cuánto cariño suma que la mascota descanse en su casita (con el tope diario de PET_BOND). */
  doghouseLove: 3,
  /** A cuántos tiles de la casita tiene que estar la mascota que te sigue. */
  doghouseReachTiles: 4,
  /** Cuánto cariño suma servirle en el comedero de la casa (con el mismo tope diario) y desde qué distancia. */
  bowlLove: 4,
  bowlReachTiles: 6,
  /** Cuánto baja la borrachera cada sorbo de agua (en "tragos", ver DRUNK). */
  waterSoberPerSip: 0.7,
} as const;

/** El vaso de agua del dispensador (gratis, como el agua de panela de la cafetera). */
export const WATER_CUP = "vaso-agua";
/** La hoja que saca la impresora. */
export const PRINTED_SHEET = "hoja";

/** Id de una nota: cuid de Prisma (letras minúsculas y números), como los de los cuadros. */
const NOTE_ID = /^[a-z0-9]{8,32}$/;

/**
 * La hoja de una nota en la mochila: `hoja:<noteId>` (el id del objeto, sin `obj:`). Lo arma solo el servidor
 * al imprimir. El título no va en el id: se lee en vivo de la nota, y solo si la hoja es de quien la escribió.
 */
export const printedSheetOf = (noteId: string) => `${PRINTED_SHEET}:${noteId}`;

/** El id de la nota de una hoja `hoja:<noteId>` (null si es la hoja genérica de antes o no es una hoja). */
export function sheetNoteIdOf(id: string): string | null {
  if (!id.startsWith(`${PRINTED_SHEET}:`)) return null;
  const noteId = id.slice(PRINTED_SHEET.length + 1);
  return NOTE_ID.test(noteId) ? noteId : null;
}

const panel = (label: string): UsableSpec => ({ action: "panel", label, cooldownMs: 800 });

/** Qué panel abre cada mueble con `panel`. */
export const MUNDO_PANEL_OF: Record<string, MundoPanel> = {
  "slot-machine": "slots",
  "claw-machine": "claw",
  "prize-shelf": "prizes",
  "fortune-wheel": "fortune",
  telescope: "telescope",
  "stargazer-scope": "telescope",
  [WALL_BOARD_TYPE]: "whiteboard",
};

export const MUNDO_USABLES: Record<string, UsableSpec> = {
  // Oficinas y pisos: el dispensador da un vaso de agua (como la cafetera) y la impresora, tu nota.
  "water-cooler": { action: "take", label: "Servirse un vaso de agua", cooldownMs: 1500, gives: [WATER_CUP] },
  printer: { action: "print", label: "Imprimir tu última nota", cooldownMs: 3_000 },
  // La pizarra de la pared de las oficinas y del estudio (la de la sala).
  [WALL_BOARD_TYPE]: panel("Abrir la pizarra"),
  // Las barandas del balcón y de la terraza: mirar el paisaje (sin destello: son muchas).
  railing: { action: "view", label: "Mirar el paisaje", cooldownMs: 4_000, marker: false },
  "railing-corner": { action: "view", label: "Mirar el paisaje", cooldownMs: 4_000, marker: false },
  // El sótano: tragamonedas, garra, estante de premios y la rueda de la fortuna.
  "slot-machine": panel("Jugar en el tragamonedas"),
  "claw-machine": panel("Jugar en la máquina de peluches"),
  "prize-shelf": panel("Ver los peluches"),
  "fortune-wheel": panel("Girar la rueda de la fortuna"),
  // Los telescopios de adorno: de noche, el cielo del observatorio.
  telescope: panel("Mirar por el telescopio"),
  "stargazer-scope": panel("Mirar por el telescopio"),
  // El jardín: el reloj de sol, la ducha de la piscina y la casita del perro.
  sundial: { action: "sundial", label: "Mirar el reloj de sol", cooldownMs: 2_500 },
  "garden-shower": { action: "shower", label: "Darse una ducha", cooldownMs: MUNDO.showerMs + 400 },
  "dog-house": { action: "doghouse", label: "Llevar a tu mascota a la casita", cooldownMs: 3_000 },
  // La casa propia: el comedero de la cocina.
  "pet-bowl": { action: "bowl", label: "Servirle a tu mascota", cooldownMs: 3_000 },
};

/** Lo gratis nuevo que se lleva en la mano (se suma a CONSUMABLES). */
export const MUNDO_CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = {
  [WATER_CUP]: { action: "sip", uses: 3 },
};

/** Qué queda en la mano (se suma a FREE_HOLDS). */
export const MUNDO_HOLDS: Record<string, readonly string[]> = {
  [WATER_CUP]: [WATER_CUP],
};

export const MUNDO_NAMES: Record<string, string> = {
  [WATER_CUP]: "Vaso de agua",
};

export const MUNDO_BLURBS: Record<string, string> = {
  [WATER_CUP]: "Del dispensador de la oficina. Fresquita, y baja un poco el guayabo.",
};

/** Cuánto baja la borrachera cada sorbo (lo que no está acá no la baja). */
export const SOBER_PER_SIP: Record<string, number> = {
  [WATER_CUP]: MUNDO.waterSoberPerSip,
};

// ---------- El reloj de sol ----------

/** Lo que dice el reloj de sol: de día la hora (a la media hora más cercana, como un reloj de sol de verdad). */
export function sundialLine(minuteOfDay: number, weather: Weather, seed: number): string {
  if (isNightMinute(minuteOfDay)) return pickLine(SUNDIAL_NIGHT, seed);
  if (weather !== "despejado" && weather !== "niebla") return pickLine(SUNDIAL_CLOUDY, seed);
  const rounded = Math.round(minuteOfDay / 30) * 30;
  return pickLine(SUNDIAL_DAY, seed).replace("{hora}", spokenHour(rounded));
}

const SUNDIAL_DAY = [
  "La sombrita dice que son {hora}. Más o menos, que el sol no usa segundero.",
  "Según el reloj de sol son {hora}. ¡Qué puntualidad la del sol!",
  "Son {hora}, dice la sombra. El sol nunca se atrasa.",
] as const;
const SUNDIAL_NIGHT = [
  "Sin sol no hay hora: el reloj de sol duerme hasta mañana.",
  "De noche la sombra se va a dormir. Mejor mira la placa del reloj.",
] as const;
const SUNDIAL_CLOUDY = [
  "Con este cielo la sombra no aparece. El reloj de sol se tomó el día.",
  "Nublado: la aguja no hace sombra. Hoy toca adivinar la hora.",
] as const;

// ---------- Mirar el paisaje ----------

/** Lo que se ve desde la baranda del balcón o la terraza, según la hora, el clima y la estación. */
export function viewLine(minuteOfDay: number, weather: Weather, season: Season, seed: number): string {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  if (weather !== "despejado") return pickLine(VIEW_WEATHER[weather], seed);
  const part = isNightMinute(m) ? "noche" : m < 10 * 60 ? "manana" : m < 17 * 60 ? "tarde" : "atardecer";
  const lines = [...VIEW_PART[part], ...VIEW_SEASON[season]];
  return pickLine(lines, seed);
}

const VIEW_PART = {
  manana: ["El jardín amanece con olor a tierra mojada y a tinto.", "Desde aquí se ve el lago quietico y el humo de la chimenea."],
  tarde: ["Se ve el huerto, el lago y hasta el techo del observatorio. Qué belleza.", "Abajo alguien pesca en el muelle. Arriba, ni una nube."],
  atardecer: ["El sol se esconde detrás del bosque y todo se pone naranja.", "Se van prendiendo los faroles del jardín, uno por uno."],
  noche: ["Las luces de la cabaña se reflejan en el lago. Arriba, estrellas.", "De noche el jardín queda en silencio: solo grillos y el arroyo."],
} as const;

const VIEW_SEASON: Record<Season, readonly string[]> = {
  primavera: ["Los árboles del huerto están florecidos: hasta acá llega el olor."],
  verano: ["Calorcito rico: el agua de la piscina brilla desde aquí."],
  otono: ["Las hojas del bosque se pusieron color ladrillo y mostaza."],
  invierno: ["El bosque está pelado y el aire huele a leña."],
};

const VIEW_WEATHER: Record<Exclude<Weather, "despejado">, readonly string[]> = {
  nublado: ["Nubes grises sobre el bosque: la luz quedó suavecita.", "Nublado, pero se ve el lago clarito."],
  lluvia: ["Llueve sobre el jardín: el lago está lleno de circulitos.", "Qué rico ver la lluvia desde acá, sin mojarse."],
  tormenta: ["¡Qué rayos! Mejor mirar la tormenta desde aquí y no desde el muelle.", "Truena duro: el bosque se dobla con el viento."],
  niebla: ["La neblina se tragó el lago. Solo se asoma la punta del observatorio.", "Neblina cerrada: el jardín parece un cuento."],
  nieve: ["¡Nieva! El jardín quedó blanquito, como una postal.", "Todo cubierto de nieve. Hasta el espantapájaros tiene gorro."],
};

// ---------- Avisos ----------

/** Servidor → quien lo intentó (`MUNDO_MSG.notice`): lo que pasó (o por qué no). */
export const MUNDO_MSG = { notice: "mundo:notice" } as const;

export const MundoNoticeCode = z.enum(["printed", "noNote", "printBusy", "full", "dry", "noPet", "petFar", "petRest", "petTired", "petEat", "petFull"]);
export type MundoNoticeCode = z.infer<typeof MundoNoticeCode>;

export interface MundoNotice {
  code: MundoNoticeCode;
  /** El título de la nota impresa o el nombre de la mascota. */
  text?: string;
}

export const MUNDO_NOTICES: Record<MundoNoticeCode, string> = {
  printed: "La impresora sacó «{text}». Quedó en tu mochila.",
  noNote: "No tienes notas para imprimir: escribe una en el PC.",
  printBusy: "La impresora todavía se está calentando. Espera un momentico.",
  full: "No te cabe en la mochila: haz espacio para llevártelo.",
  dry: "Te duchaste y quedaste sequito.",
  noPet: "Todavía no tienes mascota: adopta una y tráela contigo.",
  petFar: "Tu mascota se quedó lejos: tráela hasta aquí.",
  petRest: "{text} se echó en su casita, feliz.",
  petTired: "{text} ya descansó bastante hoy, pero igual se echa un ratico.",
  petEat: "{text} vino corriendo a comer.",
  petFull: "{text} ya comió harto hoy, pero igual se come lo que le serviste.",
};

export function mundoNoticeText(n: MundoNotice): string {
  return MUNDO_NOTICES[n.code].replace("{text}", n.text ?? "");
}
