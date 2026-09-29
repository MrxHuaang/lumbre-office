// Las marcas de los encargos en la escena: "!" sobre quien te dio un encargo que va en curso y "?" dorado
// sobre quien espera que se lo entregues (el tablón del jardín también). Solo las ve cada quien: salen de
// su libreta (useEncargos). También mide quién da encargos al alcance del jugador (para la "E" y para
// cerrar el cuadro al alejarse).
import { questGiverSpot, questGiversNear, pointsOfType, type OfficeMap } from "@hyvento/map";
import { BODY_UP, questMark, storyArrow, type QuestMarkKind } from "@hyvento/map/art";
import { QUEST_GIVER_IDS, STORY_TARGET, questGiver, type QuestGiverId } from "@hyvento/shared";
import { currentStoryStep } from "./historia";
import { selectMyOffice, useOfficeStore } from "./store";
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
  /** La flechita de la historia: señala el objetivo del paso de ahora (si queda en este nivel). */
  private arrow?: { img: Phaser.GameObjects.Image; y: number };

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
    this.arrow?.img.destroy();
    this.arrow = undefined;
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

  /** Dónde va la flechita: el objetivo del paso de la historia de ahora, o Doña Aurora si ya está para entregar. */
  private storyTarget(): { x: number; y: number; lift: number } | null {
    const map = this.map;
    const step = currentStoryStep(useEncargos.getState().quests);
    if (!map || !step) return null;
    const aurora = questGiverSpot(map, "aurora");
    const t = STORY_TARGET[step.questId];
    if (step.status === "DONE" || step.questId === "llegada-3") return aurora ? { ...aurora, lift: OVER_HEAD + 14 } : null;
    if (!t || t.area !== map.id) return null;
    if (t.point) {
      const p = pointsOfType(map, t.point)[0];
      return p ? { x: p.x, y: p.y, lift: OVER_BOARD } : null;
    }
    if (t.office) {
      const office = selectMyOffice(useOfficeStore.getState());
      const zone = office ? map.zones.find((z) => z.id === office.zoneId) : undefined;
      return zone ? { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2, lift: 20 } : null;
    }
    return null;
  }

  private refreshArrow() {
    const target = this.storyTarget();
    if (!target) {
      this.arrow?.img.destroy();
      this.arrow = undefined;
      return;
    }
    const at = worldToScreen(target.x, target.y);
    const y = Math.round(at.y - target.lift);
    if (!this.arrow) {
      const key = ensureTexture(this.scene, "historia-flecha", () => storyArrow());
      this.arrow = { img: this.scene.add.image(0, 0, key).setOrigin(0.5, 1), y };
    }
    this.arrow.y = y;
    this.arrow.img.setPosition(Math.round(at.x), y).setDepth(5e7 + depthOf(target.x, target.y) + 0.45);
  }

  update(time: number) {
    // Flotan suavecito (cada una a su ritmo); la dorada late un poco.
    for (const [i, m] of this.marks.entries()) {
      if (!m.kind) continue;
      const bob = Math.round(Math.sin(time / 420 + i) * 1.5);
      m.img.setY(Math.round(m.y + bob));
      if (m.kind === "ready") m.img.setScale(1 + Math.max(0, Math.sin(time / 260)) * 0.08);
    }
    // La flechita salta suave (como quien dice "¡por aquí!").
    if (this.arrow) this.arrow.img.setY(this.arrow.y - Math.round(Math.abs(Math.sin(time / 300)) * 4));
    if (time < this.scanAt || !this.map) return;
    this.scanAt = time + SCAN_MS;
    this.refreshArrow();
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
    this.arrow?.img.destroy();
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
