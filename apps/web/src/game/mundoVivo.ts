// Mundo lleno en la escena: lo que se ve y se oye al usar los muebles nuevos (ver mundo.ts de
// @hyvento/shared). El servidor ya aceptó el uso; aquí, si fui yo, se abre el panel (tragamonedas, garra,
// estante de premios, rueda, telescopio o pizarra) y, para todos los del nivel, la animación: la hoja que
// sale de la impresora, las gotas de la ducha, el corazón en la casita del perro y lo que dicen el reloj de
// sol y la baranda (en el globo de quien lo usó, igual para todos: sale de la semilla del servidor).
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import { heartSmall, scarecrow } from "@hyvento/map/art";
import { MUNDO, MUNDO_PANEL_OF, seasonOf, sundialLine, viewLine, type Direction, type FurnitureEvent, type Season } from "@hyvento/shared";
import * as Phaser from "phaser";
import type { Avatar } from "./Avatar";
import { currentGameTime } from "./gameClock";
import { DEPTH_OVERLAY, ensureTexture, worldToScreen, type AreaView } from "./iso/view";
import "./mundo";
import { playPrinter, playShower } from "./mundoSonidos";
import { playPurr } from "./sound";
import { useOfficeStore } from "./store";

export interface MundoHost {
  avatarOf(sessionId: string): Avatar | undefined;
  mySession(): string | undefined;
  tileSize(): number;
}

function faceToward(f: PlacedFurniture, ts: number, x: number, y: number): Direction {
  const dx = (f.x + f.w / 2) * ts - x;
  const dy = (f.y + f.d / 2) * ts - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

export class MundoVivo {
  private map?: OfficeMap;
  private view?: AreaView;
  /** La estación con la que se vistió el espantapájaros (cambia a fin de mes: se revisa cada minuto). */
  private season: Season | null = null;
  private timer: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: MundoHost,
  ) {
    this.timer = scene.time.addEvent({ delay: 60_000, loop: true, callback: () => this.dressScarecrows() });
  }

  /** Nivel nuevo: el espantapájaros se viste según la estación. */
  setArea(map: OfficeMap, view: AreaView) {
    this.map = map;
    this.view = view;
    this.season = null;
    this.dressScarecrows();
  }

  destroy() {
    this.timer.remove();
  }

  private dressScarecrows() {
    const season = seasonOf(Date.now());
    if (!this.map || !this.view || season === this.season) return;
    this.season = season;
    const key = ensureTexture(this.scene, `espantapajaros-${season}`, () => scarecrow(season).canvas);
    for (const f of this.map.furniture) if (f.type === "scarecrow") this.view.imageOf(f)?.setTexture(key);
  }

  /** Si el evento es de un mueble nuevo, lo muestra y devuelve true. */
  handleEvent(e: FurnitureEvent, f: PlacedFurniture, vol: number): boolean {
    const ts = this.host.tileSize();
    const who = this.host.avatarOf(e.sessionId);
    const mine = e.sessionId === this.host.mySession();
    const face = who ? faceToward(f, ts, who.x, who.y) : "down";
    switch (e.action) {
      case "panel": {
        who?.perform(face, 500);
        const panel = MUNDO_PANEL_OF[e.type];
        if (mine && panel) useOfficeStore.getState().openPanel(panel, true);
        return true;
      }
      case "print":
        who?.perform(face, 1800);
        playPrinter(vol);
        this.paper(f);
        return true;
      case "shower":
        playShower(vol, MUNDO.showerMs);
        if (who) this.drops(who, MUNDO.showerMs);
        return true;
      case "doghouse":
      case "bowl":
        who?.perform(face, 700);
        playPurr(vol * 0.6);
        this.heart(f);
        return true;
      case "sundial":
      case "view": {
        who?.perform(face, 1200);
        const t = currentGameTime();
        const minute = t?.minuteOfDay ?? 12 * 60;
        const weather = useOfficeStore.getState().weather;
        const text = e.action === "sundial" ? sundialLine(minute, weather, e.seed) : viewLine(minute, weather, seasonOf(Date.now()), e.seed);
        who?.say(text);
        return true;
      }
      default:
        return false;
    }
  }

  /** La hoja que sale de la impresora, blanca con renglones, y se levanta un poquito. */
  private paper(f: PlacedFurniture) {
    const ts = this.host.tileSize();
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, 14);
    const g = this.scene.add.graphics().setDepth(DEPTH_OVERLAY + 2);
    g.fillStyle(0x2a2033, 1).fillRect(-4, -5, 8, 10);
    g.fillStyle(0xfbf7ea, 1).fillRect(-3, -4, 6, 8);
    g.fillStyle(0x8aa0c8, 1).fillRect(-2, -2, 4, 1).fillRect(-2, 0, 4, 1).fillRect(-2, 2, 3, 1);
    g.setPosition(p.x, p.y + 4).setAlpha(0);
    this.scene.tweens.add({ targets: g, y: p.y - 6, alpha: 1, delay: 1200, duration: 500, ease: "Sine.out" });
    this.scene.tweens.add({ targets: g, alpha: 0, delay: 2600, duration: 500, onComplete: () => g.destroy() });
  }

  /** Gotas que caen sobre la cabeza de quien se ducha. */
  private drops(who: Avatar, ms: number) {
    const count = Math.floor(ms / 60);
    for (let k = 0; k < count; k++) {
      this.scene.time.delayedCall(k * 60, () => {
        const s = worldToScreen(who.x, who.y);
        const x = s.x + Phaser.Math.Between(-7, 7);
        const d = this.scene.add.rectangle(x, s.y - 44, 1, 3, 0x9fd8f0, 0.9).setDepth(DEPTH_OVERLAY + 2);
        this.scene.tweens.add({ targets: d, y: s.y - 6, alpha: 0.2, duration: 420, ease: "Quad.in", onComplete: () => d.destroy() });
      });
    }
  }

  /** Corazón que sale de la casita del perro. */
  private heart(f: PlacedFurniture) {
    const ts = this.host.tileSize();
    const key = ensureTexture(this.scene, "corazon-gato", () => heartSmall());
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, 18);
    const img = this.scene.add.image(p.x, p.y, key).setDepth(DEPTH_OVERLAY + 2);
    this.scene.tweens.add({ targets: img, y: p.y - 16, alpha: 0, duration: 1400, ease: "Sine.out", onComplete: () => img.destroy() });
  }
}
