// El agua que brilla (historia, capítulo 3): con el paso de pescar la llavecita abierto y lo que contó la
// Profe Celeste cumpliéndose (`aguaBrilla`: luna alta del reloj del juego y cielo limpio), el lago del jardín
// titila con destellos de luna. Cada quien ve su historia: solo lo ve quien tiene ese paso; la captura la
// decide el servidor. Los destellos se prenden y se apagan (sin moverse) encima del agua.
import { lakeTiles, type OfficeMap } from "@hyvento/map";
import { lakeGlint, LAKE_GLINT_KINDS } from "@hyvento/map/art";
import { LAGO_AREA, LAGO_PASOS, aguaBrilla } from "@hyvento/shared";
import * as Phaser from "phaser";
import { lessMotion } from "../lib/prefs";
import { useEncargos } from "./encargos";
import { currentGameTime } from "./gameClock";
import { storyStepOpen } from "./historia";
import { DEPTH_FLAT, ensureTexture, worldToScreen } from "./iso/view";
import { useOfficeStore } from "./store";

/** Cada cuánto se revisa si brilla (la hora del juego avanza de a minutos). */
const CHECK_MS = 1000;
/** Cada cuánto nace un destello, y cuántos puede haber a la vez. */
const SPAWN_MS = 70;
const MAX_GLINTS = 60;

/** ¿Me toca ver el brillo ahora? (el paso abierto y la condición de Celeste). */
function glowingForMe(): boolean {
  const t = currentGameTime();
  if (!t) return false;
  if (!storyStepOpen(useEncargos.getState().quests, LAGO_PASOS.pescar)) return false;
  return aguaBrilla(t.minuteOfDay, useOfficeStore.getState().weather);
}

export class AguaBrillaView {
  private tiles: { x: number; y: number }[] = [];
  private tileSize = 32;
  private active = false;
  private nextCheckAt = 0;
  private nextSpawnAt = 0;
  private glints = new Set<Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap) {
    this.clear();
    this.tileSize = map.tileSize;
    this.tiles = map.id === LAGO_AREA ? lakeTiles(map) : [];
    this.nextCheckAt = 0;
  }

  update(time: number) {
    if (!this.tiles.length) return;
    if (time >= this.nextCheckAt) {
      this.nextCheckAt = time + CHECK_MS;
      this.active = glowingForMe();
    }
    if (!this.active || time < this.nextSpawnAt || this.glints.size >= MAX_GLINTS) return;
    // Con menos movimiento titila menos (y cada destello dura más).
    const calm = lessMotion();
    this.nextSpawnAt = time + SPAWN_MS * (calm ? 3 : 1) * (0.6 + Math.random() * 0.8);
    this.spawn(calm);
  }

  private spawn(calm: boolean) {
    const t = this.tiles[Math.floor(Math.random() * this.tiles.length)]!;
    const ts = this.tileSize;
    const s = worldToScreen((t.x + 0.15 + Math.random() * 0.7) * ts, (t.y + 0.15 + Math.random() * 0.7) * ts);
    // Los grandes son pocos: casi todo son puntos y crucecitas.
    const r = Math.random();
    const kind = r < 0.55 ? 0 : r < 0.9 ? 1 : LAKE_GLINT_KINDS - 1;
    const key = ensureTexture(this.scene, `lago-brillo-${kind}`, () => lakeGlint(kind));
    const img = this.scene.add
      .image(Math.round(s.x), Math.round(s.y), key)
      .setDepth(DEPTH_FLAT + 2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.glints.add(img);
    this.scene.tweens.add({
      targets: img,
      alpha: { from: 0, to: 0.65 + Math.random() * 0.35 },
      duration: Phaser.Math.Between(350, 700) * (calm ? 2 : 1),
      yoyo: true,
      hold: Phaser.Math.Between(80, 400),
      ease: "Sine.inOut",
      onComplete: () => {
        this.glints.delete(img);
        img.destroy();
      },
    });
  }

  private clear() {
    for (const g of this.glints) {
      this.scene.tweens.killTweensOf(g);
      g.destroy();
    }
    this.glints.clear();
    this.active = false;
  }

  destroy() {
    this.clear();
    this.tiles = [];
  }
}
