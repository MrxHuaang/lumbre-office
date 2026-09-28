// La casa del árbol en el cliente (reglas en CASA_ARBOL de @hyvento/shared; las decide el servidor):
// el estado de la escalera y del modo foco para el panel de adentro, los mensajes, anticipar si se puede
// subir (así no se funde a negro para rebotar) y, en el jardín, la escalera recogida con el cartel
// "OCUPADO" en lugar de la que cuelga.
import { catalogItem, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { drawTreeLadder } from "@hyvento/map/art";
import {
  CASA_ARBOL,
  CASA_ARBOL_BLOCK_TEXT,
  CASA_ARBOL_MSG,
  casaArbolBlock,
  type CasaArbolBlock,
  type CasaArbolFocus,
  type CasaArbolNotice,
  type CasaArbolView,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import type * as Phaser from "phaser";
import { create } from "zustand";
import { depthOf, ensureTexture, worldToScreen, type AreaView } from "./iso/view";
import { getRoom, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

export const useCasaArbolStore = create<CasaArbolView & { set: (v: CasaArbolView) => void }>((set) => ({
  locked: false,
  lockedBy: "",
  focus: "",
  focusEndsAt: 0,
  set: (v) => set(v),
}));

interface TreeHouseRemote {
  locked: boolean;
  lockedBy: string;
  focus: string;
  focusEndsAt: number;
}

/** Engancha el estado de la casa del árbol y el aviso de "no se pudo subir" (en cada conexión). */
export function bindCasaArbol(r: OfficeRoom) {
  const $ = getStateCallbacks(r);
  const push = () => {
    const t = (r.state as unknown as { treeHouse?: TreeHouseRemote }).treeHouse;
    if (!t) return;
    const focus: CasaArbolFocus = t.focus === "focus" || t.focus === "break" ? t.focus : "";
    const before = useCasaArbolStore.getState().focus;
    useCasaArbolStore.getState().set({ locked: t.locked, lockedBy: t.lockedBy, focus, focusEndsAt: t.focusEndsAt });
    // A los de adentro, el aviso de que cambió la fase del modo foco.
    if (before !== focus && useOfficeStore.getState().area === CASA_ARBOL.area) {
      if (focus === "break") useOfficeStore.getState().notify(`Terminó el bloque de foco: ${CASA_ARBOL.breakMs / 60_000} minutos de descanso.`, "success");
      else if (focus === "focus" && before === "") useOfficeStore.getState().notify(`Pomodoro de la casa: ${CASA_ARBOL.focusMs / 60_000} minutos de concentración.`, "info");
      else if (focus === "" && before === "break") useOfficeStore.getState().notify("Terminó el descanso.", "info");
    }
  };
  ($(r.state) as unknown as { listen(field: string, cb: (v: TreeHouseRemote | undefined) => void): () => void }).listen("treeHouse", (t) => {
    if (!t) return;
    ($(t as never) as unknown as { onChange(cb: () => void): () => void }).onChange(push);
    push();
  });
  r.onMessage(CASA_ARBOL_MSG.notice, (n: CasaArbolNotice) => useOfficeStore.getState().notify(CASA_ARBOL_BLOCK_TEXT[n.code], "warning"));
}

/** Recoger (`up`) o bajar la escalera, desde adentro. */
export function sendCasaArbolLadder(up: boolean) {
  getRoom()?.send(CASA_ARBOL_MSG.ladder, { up });
}

export function sendCasaArbolFocus(action: "start" | "break" | "stop") {
  getRoom()?.send(CASA_ARBOL_MSG.focus, { action });
}

/** ¿Me dejarían subir? (lo mismo que valida el servidor, con lo que se ve del estado). */
export function casaArbolBlockFor(myUserId: string | null): CasaArbolBlock | null {
  const room = getRoom();
  if (!room) return null;
  let inside = 0;
  room.state.players.forEach((p) => {
    if (p.area === CASA_ARBOL.area && p.userId !== myUserId) inside++;
  });
  return casaArbolBlock(inside, useCasaArbolStore.getState().locked);
}

const LADDER = "treehouse-ladder";
const ROLLED_KEY = "casa-arbol-escalera-recogida";

/**
 * En el jardín: con la escalera recogida, la que cuelga se esconde y en su lugar va el rollo con el cartel
 * "OCUPADO" (mismo lienzo y origen, así calza exacto).
 */
export class TreeLadderLayer {
  private view?: AreaView;
  private ladder?: PlacedFurniture;
  private rolled?: Phaser.GameObjects.Image;
  private unsubscribe: () => void;
  private map?: OfficeMap;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe = useCasaArbolStore.subscribe((s, prev) => {
      if (s.locked !== prev.locked) this.refresh();
    });
  }

  setArea(map: OfficeMap, view: AreaView) {
    this.rolled?.destroy();
    this.rolled = undefined;
    this.map = map;
    this.view = view;
    this.ladder = map.furniture.find((f) => f.type === LADDER);
    this.refresh();
  }

  private refresh() {
    const f = this.ladder;
    const map = this.map;
    if (!f || !map || !this.view) return;
    const locked = useCasaArbolStore.getState().locked;
    this.view.setFurnitureVisible(f, !locked);
    if (!locked) {
      this.rolled?.setVisible(false);
      return;
    }
    if (!this.rolled) {
      const s = drawTreeLadder(true);
      const key = ensureTexture(this.scene, ROLLED_KEY, () => s.canvas);
      const ts = map.tileSize;
      const a = worldToScreen(f.x * ts, f.y * ts);
      const depth = catalogItem(f.type).flat ? -1e6 : depthOf((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts);
      this.rolled = this.scene.add.image(a.x - s.ox, a.y - s.oy, key).setOrigin(0, 0).setDepth(depth);
      this.view.attach(f, this.rolled);
    }
    this.rolled.setVisible(true);
  }

  destroy() {
    this.unsubscribe();
    this.rolled?.destroy();
  }
}
