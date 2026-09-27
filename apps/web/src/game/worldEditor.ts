// Editor de la casa (solo admins): en cualquier nivel se eligen, mueven, giran, quitan y agregan
// muebles. La validación es la misma que la del servidor (checkWorldEdit de @hyvento/map): el fantasma
// sale verde o rojo antes de mandar nada. Se usa desde OfficeScene con ganchos chicos.
import {
  catalogItem,
  checkWorldEdit,
  furnitureTiles,
  getWorld,
  parseWorldEdits,
  planDef,
  WORLD_EDIT_ERRORS,
  worldFurniture,
  footprint,
  type OfficeMap,
  type WorldEditOp,
  type WorldFurniture,
} from "@hyvento/map";
import * as Phaser from "phaser";
import { DEPTH_FLAT, furnitureImage, screenToWorld, tileDiamond, type AreaView } from "./iso/view";
import { getRoom, sendWorldEdit } from "./network";
import { useOfficeStore } from "./store";

const COLORS = { ok: 0x6fcf5f, bad: 0xe05a4a, pick: 0xffd66a };

export class WorldEditor {
  private ghost?: { key: string; img: Phaser.GameObjects.Image };
  private marks?: Phaser.GameObjects.Graphics;
  private hover: { x: number; y: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ctx: { map: () => OfficeMap; view: () => AreaView | undefined; me: () => { x: number; y: number } | null },
  ) {}

  get active(): boolean {
    return useOfficeStore.getState().worldEditing;
  }

  /** Cambios actuales del nivel que se ve (los del estado de la sala). */
  private edits(area: string) {
    const raw = getRoom()?.state.worldEdits?.get(area);
    return parseWorldEdits(raw ? JSON.parse(raw) : null);
  }

  private furniture(): WorldFurniture[] {
    const area = this.ctx.map().id;
    const def = planDef(area);
    return def ? worldFurniture(def, this.edits(area)) : [];
  }

  private people() {
    const area = this.ctx.map().id;
    const out: { x: number; y: number }[] = [];
    getRoom()?.state.players.forEach((p) => {
      if (p.area === area) out.push({ x: p.x, y: p.y });
    });
    return out;
  }

  private check(op: WorldEditOp) {
    const area = this.ctx.map().id;
    const def = planDef(area);
    if (!def) return { ok: false as const, error: "unknown" as const };
    return checkWorldEdit(def, this.edits(area), op, this.people());
  }

  private pose(tile: { x: number; y: number }) {
    const { decorPick, decorFacing } = useOfficeStore.getState();
    if (!decorPick) return null;
    const [w, d] = footprint(catalogItem(decorPick.type), decorFacing);
    return { type: decorPick.type, x: tile.x - Math.floor((w - 1) / 2), y: tile.y - Math.floor((d - 1) / 2), facing: decorFacing };
  }

  private opFor(pose: { type: string; x: number; y: number; facing: WorldFurniture["facing"] }): WorldEditOp {
    const pick = useOfficeStore.getState().decorPick;
    return pick?.itemId ? { action: "move", key: pick.itemId, x: pose.x, y: pose.y, facing: pose.facing } : { action: "place", ...pose };
  }

  /** El puntero se movió (px de pantalla del juego). */
  hoverAt(sx: number, sy: number) {
    const ts = this.ctx.map().tileSize;
    const w = screenToWorld(sx, sy);
    const tile = { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
    if (this.hover?.x === tile.x && this.hover.y === tile.y) return;
    this.hover = tile;
    this.refresh();
  }

  /** Redibuja el fantasma (verde o rojo) y atenúa el mueble que se está moviendo. */
  refresh(redraw = false) {
    const view = this.ctx.view();
    if (!this.active) {
      this.ghost?.img.destroy();
      this.ghost = undefined;
      this.marks?.clear();
      view?.dimFurniture(null);
      return;
    }
    const map = this.ctx.map();
    const ts = map.tileSize;
    const pick = useOfficeStore.getState().decorPick;
    const moving = pick?.itemId ? this.furniture().find((f) => f.key === pick.itemId) : undefined;
    view?.dimFurniture(moving ? (f) => f.type === moving.type && f.x === moving.x && f.y === moving.y : null);
    const pose = this.hover ? this.pose(this.hover) : null;
    const ok = Boolean(pose && this.check(this.opFor(pose)).ok);
    const key = pose ? `${pose.type}:${pose.x},${pose.y}:${pose.facing}:${ok}` : "";
    if (redraw || !pose || this.ghost?.key !== key) {
      this.ghost?.img.destroy();
      this.ghost = undefined;
    }
    this.marks ??= this.scene.add.graphics().setDepth(DEPTH_FLAT + 2);
    this.marks.clear();
    if (!pose) {
      // Sin nada elegido: se marca el mueble bajo el puntero, para que se vea qué se va a elegir.
      const under = this.hover ? this.itemAtTile(this.hover.x, this.hover.y) : null;
      if (under) {
        this.marks.fillStyle(COLORS.pick, 0.35);
        for (const t of furnitureTiles(under)) this.marks.fillPoints(tileDiamond(t.x, t.y, ts), true);
      }
      return;
    }
    if (!this.ghost) {
      const { img } = furnitureImage(this.scene, pose, useOfficeStore.getState().night, ts, ok ? "ok" : "bad");
      img.setDepth(catalogItem(pose.type).flat ? DEPTH_FLAT + 3 : img.depth + 0.5).setAlpha(0.85);
      this.ghost = { key, img };
    }
    this.marks.fillStyle(ok ? COLORS.ok : COLORS.bad, 0.45);
    for (const t of furnitureTiles(pose)) this.marks.fillPoints(tileDiamond(t.x, t.y, ts), true);
  }

  private itemAtTile(tx: number, ty: number): WorldFurniture | null {
    const items = this.furniture();
    // Primero lo que no es plano (un mueble sobre la alfombra gana).
    return (
      items.find((f) => !catalogItem(f.type).flat && furnitureTiles(f).some((t) => t.x === tx && t.y === ty)) ??
      items.find((f) => furnitureTiles(f).some((t) => t.x === tx && t.y === ty)) ??
      null
    );
  }

  /** Clic: con algo elegido lo pone o lo mueve; si no, elige el mueble bajo el puntero (los altos, un poco más abajo). */
  click(sx: number, sy: number) {
    const s = useOfficeStore.getState();
    const map = this.ctx.map();
    const ts = map.tileSize;
    const w = screenToWorld(sx, sy);
    this.hover = { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
    const pose = this.pose(this.hover);
    if (pose) {
      const op = this.opFor(pose);
      const r = this.check(op);
      if (!r.ok) return s.notify(WORLD_EDIT_ERRORS[r.error], "warning");
      sendWorldEdit({ area: map.id, op });
      if (op.action === "move") s.pickDecor(null);
      return;
    }
    for (let lift = 0; lift <= 30; lift += 4) {
      const p = screenToWorld(sx, sy + lift);
      const f = this.itemAtTile(Math.floor(p.x / ts), Math.floor(p.y / ts));
      if (!f) continue;
      if (f.fixed) return s.notify(WORLD_EDIT_ERRORS.fixed, "info");
      s.pickDecor({ type: f.type, itemId: f.key }, f.facing);
      return;
    }
  }

  /** R gira lo elegido, Supr lo quita y Esc lo suelta (o sale del editor). */
  keys(taps: { r: boolean; del: boolean; esc: boolean }) {
    const s = useOfficeStore.getState();
    if (taps.esc) {
      if (s.decorPick) s.pickDecor(null);
      else s.setWorldEditing(false);
      return;
    }
    if (taps.r && s.decorPick) s.rotateDecor();
    const pick = useOfficeStore.getState().decorPick;
    if (taps.del && pick?.itemId) {
      const r = this.check({ action: "remove", key: pick.itemId });
      if (!r.ok) return s.notify(WORLD_EDIT_ERRORS[r.error], "warning");
      sendWorldEdit({ area: this.ctx.map().id, op: { action: "remove", key: pick.itemId } });
      s.pickDecor(null);
    }
  }

  /** Quita del nivel el mueble elegido (el botón "Quitar" del panel). */
  removePicked() {
    this.keys({ r: false, del: true, esc: false });
  }
}

/** Nivel del mundo del módulo (con los cambios del editor ya aplicados). */
export const worldBase = (area: string) => getWorld().areas.get(area);
