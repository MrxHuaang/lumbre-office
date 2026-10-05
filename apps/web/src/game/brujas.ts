// La Noche de brujas en el navegador (ver noche-brujas.ts de @hyvento/shared): a quién se le puede pedir
// dulce o truco ahora (un NPC o la puerta de una oficina, con la canasta en la mano), los pedidos y sus
// respuestas, la calabaza dorada, el puesto del caldero y el maizal que se transparenta delante de uno
// para no perderse en el laberinto. Todo lo decide el servidor; aquí solo se pide y se muestra.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import {
  BRUJAS,
  BRUJAS_BUY_ERROR_TEXT,
  BRUJAS_MSG,
  BRUJAS_NPCS,
  CALABAZA_DORADA,
  CANASTA_DULCES,
  PUMPKIN_ERROR_TEXT,
  TRICK_ERROR_TEXT,
  bagItemName,
  brujasActiva,
  brujasShopItem,
  objItemId,
  trickText,
  type BrujasBuyResult,
  type BrujasShopId,
  type PumpkinResult,
  type TrickResult,
} from "@hyvento/shared";
import type * as Phaser from "phaser";
import { create } from "zustand";
import type { AreaView } from "./iso/view";
import { getRoom, onInteract, sendKnock, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

/** A quién se le pide ahora: un NPC (por su mensaje) o la puerta de una oficina (tocando). */
export type TrickTarget = { kind: "npc"; id: string; name: string } | { kind: "puerta"; zoneId: string; name: string };

interface BrujasStore {
  target: TrickTarget | null;
  /** La última respuesta del puesto (suelta el botón del panel). */
  lastBuy: (BrujasBuyResult & { seq: number }) | null;
  setTarget: (t: TrickTarget | null) => void;
}

let seq = 0;
const sameTarget = (a: TrickTarget | null, b: TrickTarget | null) =>
  a === b || (!!a && !!b && a.kind === b.kind && (a.kind === "npc" ? a.id === (b as typeof a).id : a.zoneId === (b as typeof a).zoneId));

export const useBrujasStore = create<BrujasStore>((set, get) => ({
  target: null,
  lastBuy: null,
  setTarget: (target) => {
    if (!sameTarget(get().target, target)) set({ target });
  },
}));

/** ¿Está abierta la Noche de brujas ahora? */
export const brujasNow = () => {
  const f = useOfficeStore.getState().festival;
  return brujasActiva(f.id, f.fase);
};

/** ¿Llevo la canasta en la mano? */
function holdingBasket(): boolean {
  const s = useOfficeStore.getState();
  return Boolean(s.sessionId && s.players[s.sessionId]?.held === CANASTA_DULCES);
}

/**
 * Cada cuadro (desde la escena): con el festival abierto y la canasta en la mano, el NPC de al lado o la
 * puerta de oficina ajena que se tiene enfrente (`door`, la que ya calculó la escena para las notas).
 */
export function updateTrickTarget(map: OfficeMap, me: { x: number; y: number } | undefined, door: string | null) {
  const store = useBrujasStore.getState();
  if (!me || !brujasNow() || !holdingBasket()) return store.setTarget(null);
  const ts = map.tileSize;
  // Un poco antes del límite del servidor, para que el botón no aparezca justo donde ya no alcanza.
  const reach = (BRUJAS.npcReachTiles - 0.3) * ts;
  const npc = BRUJAS_NPCS.find((n) => n.area === map.id && Math.hypot(me.x - (n.tile.x + 0.5) * ts, me.y - (n.tile.y + 0.5) * ts) <= reach);
  if (npc) return store.setTarget({ kind: "npc", id: npc.id, name: npc.name });
  const owner = door ? useOfficeStore.getState().offices[door]?.ownerName : undefined;
  store.setTarget(door && owner ? { kind: "puerta", zoneId: door, name: owner } : null);
}

/** Pedir dulce o truco a lo que se tiene al lado. */
export function trickOrTreat() {
  const t = useBrujasStore.getState().target;
  if (!t) return;
  if (t.kind === "npc") getRoom()?.send(BRUJAS_MSG.trick, { npc: t.id });
  else sendKnock(t.zoneId);
}

export function sendBrujasBuy(item: BrujasShopId) {
  getRoom()?.send(BRUJAS_MSG.buy, { item });
}

const dulceName = (id: string) => bagItemName(objItemId(id)).toLowerCase();

/** Engancha las respuestas (en cada conexión) y la E junto a la calabaza dorada. */
export function bindBrujas(r: OfficeRoom) {
  // La calabaza dorada no abre panel: E (o el clic) la toma.
  onInteract("goldenPumpkin", () => void getRoom()?.send(BRUJAS_MSG.pumpkin, {}));
  r.onMessage(BRUJAS_MSG.trickResult, (res: TrickResult) => {
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(TRICK_ERROR_TEXT[res.error], res.error === "done" ? "info" : "warning");
    // El truco ya tiene su cinemática (la manda el servidor); el dulce, el aviso con lo que dijo el NPC.
    const said = res.line ? `${res.from}: «${res.line}» ` : "";
    store.notify(`${said}${trickText(res, dulceName)}`, res.outcome.kind === "dulce" ? "success" : "info");
  });
  r.onMessage(BRUJAS_MSG.pumpkinResult, (res: PumpkinResult) => {
    const store = useOfficeStore.getState();
    if (res.ok) store.notify(`¡${bagItemName(objItemId(CALABAZA_DORADA))}! Quedó en tu mochila.`, "success");
    else store.notify(PUMPKIN_ERROR_TEXT[res.error], res.error === "done" ? "info" : "warning");
  });
  r.onMessage(BRUJAS_MSG.buyResult, (res: BrujasBuyResult) => {
    useBrujasStore.setState({ lastBuy: { ...res, seq: ++seq } });
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(BRUJAS_BUY_ERROR_TEXT[res.error], "warning");
    store.notify(`${brujasShopItem(res.item)?.name ?? "La compra"} a la mochila.`, "success");
  });
}

// ---------- El maizal que se transparenta ----------

/** Qué tan transparente queda el maíz que tapa a uno (1 = opaco). */
const CORN_SEE_THROUGH = 0.38;
const isCorn = (type: string) => type.startsWith("corn-maze-");

/**
 * Las matas del laberinto son altas: las que quedan delante de uno (más al sur o al este, a un par de
 * tiles) se transparentan para verse adentro. Solo en el nivel con maizal y solo las de cerca.
 */
export class MaizalVivo {
  private corn: { f: PlacedFurniture; img?: Phaser.GameObjects.Image }[] = [];
  private view?: AreaView;
  private ts = 32;

  setArea(map: OfficeMap, view: AreaView) {
    this.view = view;
    this.ts = map.tileSize;
    this.corn = map.furniture.filter((f) => isCorn(f.type)).map((f) => ({ f }));
  }

  update(me: { x: number; y: number } | undefined, delta: number) {
    if (!this.corn.length || !this.view) return;
    const tx = me ? me.x / this.ts : -99;
    const ty = me ? me.y / this.ts : -99;
    const k = Math.min(1, delta / 160);
    for (const c of this.corn) {
      c.img ??= this.view.imageOf(c.f);
      const img = c.img;
      if (!img) continue;
      const dx = c.f.x + 0.5 - tx;
      const dy = c.f.y + 0.5 - ty;
      // Delante en la vista isométrica: hacia +x o +y, a menos de ~3 tiles.
      const front = dx + dy > 0 && dx > -1.2 && dy > -1.2 && dx + dy < 3.6;
      const target = front ? CORN_SEE_THROUGH : 1;
      if (Math.abs(img.alpha - target) > 0.01) img.setAlpha(img.alpha + (target - img.alpha) * k);
    }
  }
}
