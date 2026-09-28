// El observatorio en la escena: el orrery que gira (los brazos con los planetas van como capa sobre el
// pedestal) y el palito del malvavisco en la mano de quien lo está asando, dorándose con el mismo calor
// que sorteó el servidor. Solo dibujo; las reglas están en el servidor (rooms/observatorio.ts).
import { catalogItem, footprint, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { BODY_UP, orreryArms, ORRERY_FRAMES, roastStick } from "@hyvento/map/art";
import { doneness, donenessTone, type Direction } from "@hyvento/shared";
import type * as Phaser from "phaser";
import type { Avatar } from "./Avatar";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";
import { useObservatorio } from "./observatorio";

/** Cuánto dura una vuelta del planeta más lento del orrery. */
const ORRERY_TURN_MS = 40_000;
/** Mano que sostiene el palito respecto de los pies (como la caña de pescar). */
const HAND: Record<Direction, { x: number; y: number }> = {
  right: { x: 5, y: -(BODY_UP.hand + 1) },
  down: { x: -5, y: -(BODY_UP.hand + 1) },
  left: { x: -6, y: -(BODY_UP.hand + 2) },
  up: { x: 6, y: -(BODY_UP.hand + 2) },
};

export class ObservatorioVivo {
  private map?: OfficeMap;
  private orreries: { f: PlacedFurniture; img: Phaser.GameObjects.Image; frame: number }[] = [];
  private sticks = new Map<string, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatarOf: (sessionId: string) => Avatar | undefined,
    private readonly inArea: (sessionId: string) => boolean,
  ) {}

  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
    for (const f of map.furniture) if (f.type === "orrery") this.orreries.push({ f, img: this.scene.add.image(0, 0, this.orreryKey(0)).setOrigin(0, 0), frame: -1 });
  }

  private orreryKey(i: number) {
    return ensureTexture(this.scene, `obs-orrery-${i}`, () => orreryArms(i / ORRERY_FRAMES).canvas);
  }

  update(time: number) {
    const map = this.map;
    if (!map) return;
    const ts = map.tileSize;
    // Orrery: cada cuadro de la vuelta, en el mismo lugar y con la profundidad del pedestal.
    const frame = Math.floor(((time % ORRERY_TURN_MS) / ORRERY_TURN_MS) * ORRERY_FRAMES);
    for (const o of this.orreries) {
      if (o.frame === frame) continue;
      o.frame = frame;
      const s = orreryArms(frame / ORRERY_FRAMES);
      const a = worldToScreen(o.f.x * ts, o.f.y * ts);
      const [w, d] = footprint(catalogItem(o.f.type), o.f.facing);
      o.img
        .setTexture(this.orreryKey(frame))
        .setPosition(Math.round(a.x - s.ox), Math.round(a.y - s.oy))
        .setDepth(depthOf((o.f.x + w / 2) * ts, (o.f.y + d / 2) * ts) + 0.01);
    }
    // Palitos de malvavisco.
    const roasts = useObservatorio.getState().roasts;
    for (const [id, img] of this.sticks)
      if (!roasts[id]) {
        img.destroy();
        this.sticks.delete(id);
      }
    const now = performance.now();
    for (const [id, r] of Object.entries(roasts)) {
      const avatar = this.avatarOf(id);
      if (!avatar || !this.inArea(id)) {
        this.sticks.get(id)?.setVisible(false);
        continue;
      }
      const tone = donenessTone(doneness(now - r.startedAt, r.heat));
      const key = ensureTexture(this.scene, `obs-palito-${tone}`, () => roastStick(tone));
      let img = this.sticks.get(id);
      if (!img) {
        img = this.scene.add.image(0, 0, key).setOrigin(1, 1);
        this.sticks.set(id, img);
      }
      const dir = avatar.direction;
      const p = worldToScreen(avatar.x, avatar.y);
      const hand = HAND[dir];
      // El dibujo apunta a la izquierda y arriba; mirando a la derecha de la pantalla se voltea.
      const flip = dir === "right" || dir === "up";
      img
        .setTexture(key)
        .setFlipX(flip)
        .setOrigin(flip ? 0 : 1, 1)
        .setPosition(Math.round(p.x + hand.x), Math.round(p.y + hand.y + 2))
        .setDepth(depthOf(avatar.x, avatar.y) + (dir === "right" || dir === "down" ? 0.56 : 0.44))
        .setVisible(true);
    }
  }

  private clear() {
    for (const o of this.orreries) o.img.destroy();
    this.orreries = [];
    for (const img of this.sticks.values()) img.destroy();
    this.sticks.clear();
  }

  destroy() {
    this.clear();
    this.map = undefined;
  }
}
