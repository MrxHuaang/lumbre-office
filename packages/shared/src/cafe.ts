// Fase 3a: el menú de la cafetería (y, con el rediseño, la carta del bar del club). Lo que pides en la
// barra lo llevas en la mano un rato (los combos, una cosa en cada mano), todos lo ven y se usa con F
// (ver consumables.ts). Solo es decorativo: no da puntos ni ventajas.
import { z } from "zod";
import { FREE_HOLDS } from "./casa";

/** Las secciones de la carta de la cafetería (pestañas del panel), en el orden en que se muestran. */
export const CAFE_CATEGORIES = [
  { id: "calientes", label: "Bebidas calientes" },
  { id: "frias", label: "Bebidas frías" },
  { id: "panaderia", label: "Panadería" },
  { id: "fritos", label: "Fritos y arepas" },
  { id: "desayunos", label: "Desayunos" },
  { id: "postres", label: "Postres y dulces" },
  { id: "combos", label: "Combos" },
  { id: "otros", label: "Otros" },
] as const;
export type CafeCategory = (typeof CAFE_CATEGORIES)[number]["id"];

/**
 * `holds`: lo que queda en las manos (los combos son dos cosas, una en cada mano). Cada id de `holds`
 * tiene su dibujo en packages/map/src/art/items.ts y su forma de usarse en consumables.ts.
 * `category`: la pestaña de la carta en la que sale.
 */
export const CAFE_MENU = [
  // ---------- Bebidas calientes ----------
  { id: "tinto", name: "Tinto", price: 3, kind: "drink", category: "calientes", holds: ["tinto"], blurb: "Café negro, pequeño y bien cargado." },
  { id: "perico", name: "Perico", price: 4, kind: "drink", category: "calientes", holds: ["perico"], blurb: "Tinto con un chorrito de leche, en pocillo." },
  { id: "cafe-leche", name: "Café con leche", price: 5, kind: "drink", category: "calientes", holds: ["cafe-leche"], blurb: "En taza grande, para la mañana." },
  { id: "cafe-campesino", name: "Café campesino", price: 4, kind: "drink", category: "calientes", holds: ["cafe-campesino"], blurb: "Con panela y canela, en pocillo de peltre." },
  { id: "aromatica", name: "Aromática", price: 4, kind: "drink", category: "calientes", holds: ["aromatica"], blurb: "Infusión de frutas y hierbabuena." },
  {
    id: "agua-panela-queso",
    name: "Agua de panela con queso",
    price: 6,
    kind: "drink",
    category: "calientes",
    holds: ["agua-panela-queso"],
    blurb: "Calientita, con el queso derritiéndose adentro.",
  },
  { id: "milo", name: "Milo caliente", price: 6, kind: "drink", category: "calientes", holds: ["milo"], blurb: "Chocolatoso y espeso, como en el colegio." },
  { id: "chocolate", name: "Chocolate con queso", price: 8, kind: "drink", category: "calientes", holds: ["chocolate"], blurb: "Caliente, con su tajada de queso." },
  // ---------- Bebidas frías ----------
  { id: "coca-cola", name: "Coca-Cola", price: 5, kind: "drink", category: "frias", holds: ["coca-cola"], blurb: "Bien fría, en lata." },
  { id: "gaseosa-manzana", name: "Gaseosa de manzana", price: 4, kind: "drink", category: "frias", holds: ["gaseosa-manzana"], blurb: "La roja de siempre, en botella de vidrio." },
  { id: "jugo-mora", name: "Jugo de mora", price: 6, kind: "drink", category: "frias", holds: ["jugo-mora"], blurb: "En leche, bien espeso." },
  { id: "jugo-lulo", name: "Jugo de lulo", price: 6, kind: "drink", category: "frias", holds: ["jugo-lulo"], blurb: "Ácido y fresquito, con pepitas." },
  { id: "jugo-maracuya", name: "Jugo de maracuyá", price: 6, kind: "drink", category: "frias", holds: ["jugo-maracuya"], blurb: "Amarillo, perfumado y con hielo." },
  { id: "jugo-guanabana", name: "Jugo de guanábana", price: 7, kind: "drink", category: "frias", holds: ["jugo-guanabana"], blurb: "En leche, cremoso y dulcecito." },
  { id: "jugo-mango", name: "Jugo de mango", price: 6, kind: "drink", category: "frias", holds: ["jugo-mango"], blurb: "De mango maduro, sin colar." },
  { id: "limonada-coco", name: "Limonada de coco", price: 8, kind: "drink", category: "frias", holds: ["limonada-coco"], blurb: "Frappé, con coco rallado encima." },
  { id: "avena", name: "Avena fría", price: 5, kind: "drink", category: "frias", holds: ["avena"], blurb: "Con canela, en vaso grande." },
  { id: "kumis", name: "Kumis", price: 5, kind: "drink", category: "frias", holds: ["kumis"], blurb: "Casero, en vasito, con un toque de azúcar." },
  { id: "champus", name: "Champús", price: 6, kind: "drink", category: "frias", holds: ["champus"], blurb: "De lulo, piña y maíz, como en Cali." },
  { id: "salpicon", name: "Salpicón", price: 7, kind: "drink", category: "frias", holds: ["salpicon"], blurb: "Frutas picadas en jugo de sandía." },
  // ---------- Panadería ----------
  { id: "pandebono", name: "Pandebono", price: 5, kind: "food", category: "panaderia", holds: ["pandebono"], blurb: "Recién salido del horno." },
  { id: "pan-yuca", name: "Pan de yuca", price: 4, kind: "food", category: "panaderia", holds: ["pan-yuca"], blurb: "En herradura, suavecito y con queso." },
  { id: "almojabana", name: "Almojábana", price: 5, kind: "food", category: "panaderia", holds: ["almojabana"], blurb: "Esponjosa, de cuajada. Pide chocolate." },
  { id: "bunuelo", name: "Buñuelo", price: 5, kind: "food", category: "panaderia", holds: ["bunuelo"], blurb: "Redondo, dorado y crocante." },
  { id: "roscon", name: "Roscón de arequipe", price: 6, kind: "food", category: "panaderia", holds: ["roscon"], blurb: "Con azúcar por encima y relleno de arequipe." },
  { id: "croissant", name: "Croissant de jamón y queso", price: 7, kind: "food", category: "panaderia", holds: ["croissant"], blurb: "Hojaldrado y calentito." },
  { id: "achiras", name: "Achiras", price: 4, kind: "food", category: "panaderia", holds: ["achiras"], blurb: "Del Huila, en bolsita. Se deshacen en la boca." },
  // ---------- Fritos y arepas ----------
  { id: "empanada", name: "Empanada", price: 4, kind: "food", category: "fritos", holds: ["empanada"], blurb: "De maíz, con papa y carne. Con ají." },
  { id: "dedito", name: "Dedito de queso", price: 4, kind: "food", category: "fritos", holds: ["dedito"], blurb: "Crocante por fuera y el queso estirado." },
  { id: "papa-rellena", name: "Papa rellena", price: 6, kind: "food", category: "fritos", holds: ["papa-rellena"], blurb: "Con carne, arroz y huevo adentro." },
  { id: "carimanola", name: "Carimañola", price: 6, kind: "food", category: "fritos", holds: ["carimanola"], blurb: "De yuca, rellena de carne, costeña." },
  { id: "aborrajado", name: "Aborrajado", price: 7, kind: "food", category: "fritos", holds: ["aborrajado"], blurb: "Maduro con queso, apanado y frito." },
  { id: "arepa-huevo", name: "Arepa de huevo", price: 7, kind: "food", category: "fritos", holds: ["arepa-huevo"], blurb: "Frita, con el huevo adentro, como en la Costa." },
  { id: "arepa-queso", name: "Arepa con queso", price: 5, kind: "food", category: "fritos", holds: ["arepa-queso"], blurb: "Asada, con mantequilla y quesito." },
  { id: "arepa-boyacense", name: "Arepa boyacense", price: 6, kind: "food", category: "fritos", holds: ["arepa-boyacense"], blurb: "Dulcecita y rellena de cuajada." },
  { id: "arepa-choclo", name: "Arepa de choclo", price: 7, kind: "food", category: "fritos", holds: ["arepa-choclo"], blurb: "De maíz tierno, con quesito encima." },
  // ---------- Desayunos ----------
  { id: "huevos-pericos", name: "Huevos pericos", price: 9, kind: "food", category: "desayunos", holds: ["huevos-pericos"], blurb: "Con tomate y cebolla larga, en platico." },
  { id: "changua", name: "Changua", price: 8, kind: "food", category: "desayunos", holds: ["changua"], blurb: "Caldo de leche con huevo y cilantro." },
  { id: "calentado", name: "Calentado", price: 12, kind: "food", category: "desayunos", holds: ["calentado"], blurb: "Fríjoles con arroz, huevo frito y arepa." },
  { id: "tamal", name: "Tamal tolimense", price: 12, kind: "food", category: "desayunos", holds: ["tamal"], blurb: "Envuelto en hoja de plátano. Para el domingo." },
  // ---------- Postres y dulces ----------
  { id: "cocada", name: "Cocada", price: 3, kind: "food", category: "postres", holds: ["cocada"], blurb: "De coco y panela, bien melcochuda." },
  { id: "bocadillo", name: "Bocadillo con queso", price: 3, kind: "food", category: "postres", holds: ["bocadillo"], blurb: "Guayaba y queso: el matrimonio perfecto." },
  { id: "natilla", name: "Natilla", price: 5, kind: "food", category: "postres", holds: ["natilla"], blurb: "Con canela, aunque no sea diciembre." },
  { id: "obleas", name: "Oblea con arequipe", price: 6, kind: "food", category: "postres", holds: ["obleas"], blurb: "Crocante, con arequipe y mora." },
  { id: "arroz-con-leche", name: "Arroz con leche", price: 6, kind: "food", category: "postres", holds: ["arroz-con-leche"], blurb: "Cremoso, con uvas pasas y canela." },
  { id: "brevas", name: "Brevas con arequipe", price: 7, kind: "food", category: "postres", holds: ["brevas"], blurb: "Brevas caladas, con arequipe encima." },
  { id: "cholado", name: "Cholado", price: 9, kind: "food", category: "postres", holds: ["cholado"], blurb: "Hielo raspado, frutas, leche condensada y barquillo." },
  { id: "merengon", name: "Merengón", price: 10, kind: "food", category: "postres", holds: ["merengon"], blurb: "Merengue, crema y fresas. Se desmorona." },
  { id: "torta", name: "Torta de tres leches", price: 12, kind: "food", category: "postres", holds: ["torta"], blurb: "Para celebrar algo (o nada)." },
  // ---------- Combos (más baratos que por separado) ----------
  { id: "onces", name: "Las onces: tinto y pandebono", price: 7, kind: "combo", category: "combos", holds: ["tinto", "pandebono"], blurb: "El clásico de media tarde." },
  { id: "perico-arepa", name: "Perico y arepa con queso", price: 8, kind: "combo", category: "combos", holds: ["perico", "arepa-queso"], blurb: "Desayuno de pueblo, sin afán." },
  {
    id: "chocolate-almojabana",
    name: "Chocolate con almojábana",
    price: 11,
    kind: "combo",
    category: "combos",
    holds: ["chocolate", "almojabana"],
    blurb: "Con queso para mojar, como donde la abuela.",
  },
  {
    id: "media-manana",
    name: "Media mañana: lulo y empanada",
    price: 9,
    kind: "combo",
    category: "combos",
    holds: ["jugo-lulo", "empanada"],
    blurb: "Para aguantar hasta el almuerzo.",
  },
  { id: "avena-bunuelo", name: "Avena con buñuelo", price: 8, kind: "combo", category: "combos", holds: ["avena", "bunuelo"], blurb: "El combo de la panadería del barrio." },
  {
    id: "desayuno-tinto",
    name: "Desayuno: tinto y cigarro",
    price: 6,
    kind: "combo",
    category: "combos",
    holds: ["tinto", "cigarro"],
    blurb: "El desayuno de campeones (sale más barato).",
  },
  {
    id: "desayuno-coca",
    name: "Desayuno: Coca-Cola y cigarro",
    price: 8,
    kind: "combo",
    category: "combos",
    holds: ["coca-cola", "cigarro"],
    blurb: "La versión fría del desayuno (sale más barato).",
  },
  // ---------- Otros ----------
  { id: "cigarro", name: "Cigarro", price: 4, kind: "smoke", category: "otros", holds: ["cigarro"], blurb: "Para la pausa en el porche." },
] as const satisfies readonly ({ category: CafeCategory } & Record<string, unknown>)[];

/** Los productos de una sección de la carta, en su orden. */
export const cafeItemsIn = (category: CafeCategory): CafeItem[] => CAFE_MENU.filter((i) => i.category === category);

export type CafeItem = (typeof CAFE_MENU)[number];
export type CafeItemId = CafeItem["id"];
export const CAFE_ITEM_IDS = CAFE_MENU.map((i) => i.id) as [CafeItemId, ...CafeItemId[]];

export function cafeItem(id: string): CafeItem | undefined {
  return CAFE_MENU.find((i) => i.id === id);
}

/**
 * Rediseño: la carta del bar del club (sótano). Mismo sistema que la cafetería: se pide junto a la barra
 * (punto `club_bar`), se paga con puntos y queda en la mano. Los ids no se repiten con los de la cafetería
 * (lo que llevas en la mano se guarda por id, venga de donde venga).
 */
export const BAR_MENU = [
  { id: "cerveza", name: "Cerveza", price: 6, kind: "drink", holds: ["cerveza"], blurb: "Rubia, bien fría y con espuma." },
  { id: "vino", name: "Copa de vino", price: 9, kind: "drink", holds: ["vino"], blurb: "Tinto de la casa, en copa." },
  { id: "coctel", name: "Cóctel de la casa", price: 12, kind: "drink", holds: ["coctel"], blurb: "Con sombrillita y cereza." },
  { id: "whisky", name: "Whisky en las rocas", price: 14, kind: "drink", holds: ["whisky"], blurb: "Dos hielos, sin prisa." },
  { id: "cigarro-club", name: "Cigarro", price: 4, kind: "smoke", holds: ["cigarro"], blurb: "Para acompañar el trago." },
  { id: "habano", name: "Habano", price: 20, kind: "smoke", holds: ["habano"], blurb: "Grande, de hoja oscura. Dura bastante." },
  {
    id: "previa",
    name: "La previa: cerveza y cigarro",
    price: 8,
    kind: "combo",
    holds: ["cerveza", "cigarro"],
    blurb: "Una en cada mano (sale más barato).",
  },
  {
    id: "padrino",
    name: "El padrino: whisky y habano",
    price: 30,
    kind: "combo",
    holds: ["whisky", "habano"],
    blurb: "Para cerrar la noche como se debe.",
  },
] as const;

export type BarItem = (typeof BAR_MENU)[number];
export type BarItemId = BarItem["id"];
export const BAR_ITEM_IDS = BAR_MENU.map((i) => i.id) as [BarItemId, ...BarItemId[]];

export function barItem(id: string): BarItem | undefined {
  return BAR_MENU.find((i) => i.id === id);
}

/**
 * La confitería del cine (sótano, junto a la máquina de crispetas): lo de ver la película. Los ids no se
 * repiten con los de las otras cartas; la gaseosa es la misma lata de la cafetería.
 */
export const CINEMA_MENU = [
  { id: "crispetas", name: "Crispetas", price: 6, kind: "food", holds: ["crispetas"], blurb: "Saladitas y con mantequilla, en su caja de rayas." },
  { id: "crispetas-caramelo", name: "Crispetas de caramelo", price: 8, kind: "food", holds: ["crispetas-caramelo"], blurb: "Dulces y crocantes, pegadas de a dos." },
  { id: "gaseosa-cine", name: "Gaseosa", price: 5, kind: "drink", holds: ["coca-cola"], blurb: "Bien fría, para no atorarse con las crispetas." },
  {
    id: "combo-cine",
    name: "Combo función: crispetas y gaseosa",
    price: 9,
    kind: "combo",
    holds: ["crispetas", "coca-cola"],
    blurb: "Una en cada mano (sale más barato).",
  },
] as const;

export type CinemaMenuItem = (typeof CINEMA_MENU)[number];
export type CinemaMenuItemId = CinemaMenuItem["id"];
export const CINEMA_MENU_IDS = CINEMA_MENU.map((i) => i.id) as [CinemaMenuItemId, ...CinemaMenuItemId[]];

export function cinemaMenuItem(id: string): CinemaMenuItem | undefined {
  return CINEMA_MENU.find((i) => i.id === id);
}

/**
 * Las cartas: dónde se pide cada una (tipo de punto del mapa) y en qué muebles se hace clic para
 * abrirla (la barra nueva del club suma los grifos de cerveza, "bar-taps").
 */
export const MENUS = {
  cafe: { point: "cafe_counter", items: CAFE_MENU, furniture: ["counter-coffee", "pastry-case", "counter"] },
  bar: { point: "club_bar", items: BAR_MENU, furniture: ["bar-counter", "bar-shelf", "bar-taps", "cigar-case"] },
  cine: { point: "cinema_snacks", items: CINEMA_MENU, furniture: ["popcorn-machine"] },
} as const;
export type MenuId = keyof typeof MENUS;
export type MenuItem = CafeItem | BarItem | CinemaMenuItem;
export type MenuItemId = MenuItem["id"];

/** Un producto de cualquiera de las cartas, con la carta de la que sale. */
export function menuItem(id: string): (MenuItem & { menu: MenuId }) | undefined {
  const cafe = cafeItem(id);
  if (cafe) return { ...cafe, menu: "cafe" };
  const bar = barItem(id);
  if (bar) return { ...bar, menu: "bar" };
  const cine = cinemaMenuItem(id);
  return cine ? { ...cine, menu: "cine" } : undefined;
}

/** Lo que se ve en las manos por un pedido (vacío si el id no es de ninguna carta). */
export function heldParts(id: string): readonly string[] {
  // Lo gratis de la casa (la nevera, la fogata) no sale de ninguna carta.
  return menuItem(id)?.holds ?? FREE_HOLDS[id] ?? [];
}

export const CAFE = {
  /** Cuánto tiempo llevas en la mano lo que pediste. */
  heldMs: 30 * 60_000,
  /** Tiempo mínimo entre dos pedidos de la misma persona (evita dobles clics). */
  orderCooldownMs: 1500,
} as const;

/** `refId` de un movimiento de puntos por una compra en la cafetería. */
export const cafeRefId = (item: CafeItemId) => `cafe:${item}`;
/** `refId` de una compra en el bar del club. */
export const barRefId = (item: BarItemId) => `bar:${item}`;
/** `refId` de una compra en cualquiera de las dos barras ("cafe:tinto", "bar:whisky"). */
export const menuRefId = (item: MenuItemId) => `${menuItem(item)?.menu ?? "cafe"}:${item}`;

/** Cliente → servidor: pedir algo en la barra (hay que estar junto a ella). */
export const CafeOrderMessage = z.object({ item: z.enum(CAFE_ITEM_IDS) });
export type CafeOrderMessage = z.infer<typeof CafeOrderMessage>;

/** Cliente → servidor: pedir en la barra del club (hay que estar junto a ella). */
export const BarOrderMessage = z.object({ item: z.enum(BAR_ITEM_IDS) });
export type BarOrderMessage = z.infer<typeof BarOrderMessage>;

/** Cliente → servidor: pedir en la confitería del cine (hay que estar junto a la máquina de crispetas). */
export const CinemaOrderMessage = z.object({ item: z.enum(CINEMA_MENU_IDS) });
export type CinemaOrderMessage = z.infer<typeof CinemaOrderMessage>;

/** Servidor → cliente: resultado del pedido (en la cafetería o en el bar; `item` dice de cuál). */
export type CafeOrderResult =
  | { ok: true; item: MenuItemId; balance: number }
  | { ok: false; item: MenuItemId; error: "far" | "funds" | "busy" | "failed" };
