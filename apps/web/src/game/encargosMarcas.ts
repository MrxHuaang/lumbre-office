// Las marcas de los encargos en la escena: "!" sobre quien te dio un encargo que va en curso y "?" dorado
// sobre quien espera que se lo entregues (el tablón del jardín también). Solo las ve cada quien: salen de
// su libreta (useEncargos). También mide quién da encargos al alcance del jugador (para la "E" y para
// cerrar el cuadro al alejarse).
import { questGiverSpot, questGiversNear, pointsOfType, type OfficeMap } from "@hyvento/map";
import { BODY_UP, questMark, type QuestMarkKind } from "@hyvento/map/art";
import { QUEST_GIVER_IDS, questGiver, type QuestGiverId } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { giverMark, useEncargos } from "./encargos";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";

/** Cada cuánto se mide quién está al alcance. */
const SCAN_MS = 200;
/** Sobre la cabeza de un personaje: el nombre va en la coronilla + 7; la marca, encima del nombre. */
const OVER_HEAD = BODY_UP.crown + 7 + 14;
/** Sobre el tablón (un mueble de un tile, más o menos de la altura de una persona). */
const OVER_BOARD = 40;

interface Mark {
  giver: QuestGiverId;
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  kind: QuestMarkKind | null;
}

export interface QuestMarkDeps {
  /** El jugador local (px de mundo), o null. */
  local: () => { x: number; y: number } | null;
}

export class QuestMarkers {
  private map?: OfficeMap;
  private marks: Mark[] = [];
  private scanAt = 0;
  private unsub: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: QuestMarkDeps,
  ) {
    this.unsub = useEncargos.subscribe((s, prev) => {
      if (s.quests !== prev.quests) this.refresh();
    });
  }

  /** Cambió el nivel que se ve: una marca por cada quien da encargos en este nivel (escondida si no hay nada). */
  setArea(map: OfficeMap) {
    this.map = map;
    for (const m of this.marks) m.img.destroy();
    this.marks = [];
    for (const giver of QUEST_GIVER_IDS) {
      const spots: { x: number; y: number; lift: number }[] = [];
      const npc = questGiverSpot(map, giver);
      if (npc) spots.push({ ...npc, lift: OVER_HEAD });
      // Sin personaje (el tablón), la marca va sobre su punto del mapa.
      const point = questGiver(giver)?.point;
      if (!npc && point) for (const p of pointsOfType(map, point)) spots.push({ x: p.x, y: p.y, lift: OVER_BOARD });
      for (const s of spots) {
        const at = worldToScreen(s.x, s.y);
        const img = this.scene.add
          .image(Math.round(at.x), Math.round(at.y - s.lift), this.texture("active"))
          .setOrigin(0.5, 1)
          .setDepth(5e7 + depthOf(s.x, s.y) + 0.4)
          .setVisible(false);
        this.marks.push({ giver, x: at.x, y: at.y - s.lift, img, kind: null });
      }
    }
    useEncargos.setState({ near: [] });
    this.refresh();
  }

  update(time: number) {
    // Flotan suavecito (cada una a su ritmo); la dorada late un poco.
    for (const [i, m] of this.marks.entries()) {
      if (!m.kind) continue;
      const bob = Math.round(Math.sin(time / 420 + i) * 1.5);
      m.img.setY(Math.round(m.y + bob));
      if (m.kind === "ready") m.img.setScale(1 + Math.max(0, Math.sin(time / 260)) * 0.08);
    }
    if (time < this.scanAt || !this.map) return;
    this.scanAt = time + SCAN_MS;
    const me = this.deps.local();
    const near = me ? questGiversNear(this.map, me.x, me.y) : [];
    const prev = useEncargos.getState().near;
    if (near.length !== prev.length || near.some((g, i) => g !== prev[i])) useEncargos.setState({ near });
    // Me alejé de quien me estaba hablando: se cierra su cuadro.
    const talking = useEncargos.getState().talking;
    if (talking && !near.includes(talking.giver)) useEncargos.setState({ talking: null });
  }

  destroy() {
    this.unsub();
    for (const m of this.marks) m.img.destroy();
    this.marks = [];
  }

  private texture(kind: QuestMarkKind) {
    return ensureTexture(this.scene, `encargo-marca-${kind}`, () => questMark(kind));
  }

  private refresh() {
    const quests = useEncargos.getState().quests;
    for (const m of this.marks) {
      const kind = giverMark(quests, m.giver);
      m.kind = kind;
      m.img.setVisible(Boolean(kind));
      if (kind) m.img.setTexture(this.texture(kind)).setScale(1);
    }
  }
}

export { questGiverToTalk } from "./encargos";
