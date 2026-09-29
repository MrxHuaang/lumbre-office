// La pesca del jugador local en la escena: las teclas mientras se pesca (E, espacio, clic, Esc) y el
// minijuego, dibujado en pixel junto al personaje (no es una ventana). El minijuego corre a 60 frames por
// segundo con la semilla del servidor y guarda en qué frames cambió el botón: eso es lo que se manda.
import type { OfficeMap } from "@hyvento/map";
import { drawFishingBar, FISHING_BAR, PixelCanvas } from "@hyvento/map/art";
import { FishingSim, SIM, SIM_FRAME_MS, type Direction } from "@hyvento/shared";
import * as Phaser from "phaser";
import { focusOwnsKey } from "@/lib/keyboardFocus";
import type { Avatar } from "../Avatar";
import { worldToScreen } from "../iso/view";
import { useOfficeStore } from "../store";
import { cancelFishing, hookFish, nibbling, sendFishResult, fishingSpotAction } from "./net";
import { playFishSound } from "./sound";
import { useFishingStore, type FishingLocalPhase } from "./store";
import { castTarget, SCREEN_DIR } from "./water";

/** Cuánto se ve la barra congelada al terminar, antes de mandar el resultado. */
const RESULT_MS = 700;
/** Si el servidor no contesta en este tiempo, se suelta la caña (p. ej. se cortó la conexión). */
const STUCK_MS = 6000;
/** Tope de frames por cuadro (si la pestaña se trabó no se "adelanta" de golpe). */
const MAX_STEPS = 6;
/** Por encima de los nombres y los globos (que van en 5e7 y 6e7). */
const MINIGAME_DEPTH = 8e7;

const TRANSITIONAL: FishingLocalPhase[] = ["casting", "hooking", "finishing"];

export class FishingController {
  private space: Phaser.Input.Keyboard.Key;
  private sim?: FishingSim;
  private inputs: number[] = [];
  private hold = false;
  private acc = 0;
  private t = 0;
  private endedAt = 0;
  private sent = false;
  private px = new PixelCanvas(FISHING_BAR.w, FISHING_BAR.h);
  private tex?: Phaser.Textures.CanvasTexture;
  private img?: Phaser.GameObjects.Image;
  private phaseSince = 0;
  private unsubscribe: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly local: () => Avatar | undefined,
    private readonly map: () => OfficeMap,
  ) {
    this.space = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
    this.unsubscribe = useFishingStore.subscribe((s, prev) => {
      if (s.phase !== prev.phase) this.phaseSince = performance.now();
      if (s.phase === "reeling" && s.challenge && prev.phase !== "reeling") this.startMinigame();
      if (s.phase === "idle" && prev.phase !== "idle") this.stopMinigame();
    });
  }

  /** ¿Pescando? (la escena no mueve al personaje ni muestra otras ayudas). */
  get busy() {
    return useFishingStore.getState().phase !== "idle";
  }

  /** Hacia dónde tiene que mirar el personaje mientras pesca (hacia el agua). */
  facing(): Direction | null {
    const me = this.local();
    if (!me || !this.busy) return null;
    return castTarget(this.map(), me.x, me.y)?.dir ?? null;
  }

  /** Teclas de un toque con la caña en la mano. `moving` = aprieta una flecha o WASD. */
  control(taps: { e: boolean; esc: boolean }, moving: boolean) {
    const { phase } = useFishingStore.getState();
    if (taps.esc || (moving && (phase === "waiting" || phase === "bite"))) return cancelFishing();
    // Con la boya temblando por un mordisqueo, la tecla es responder (y el pez se asusta): hay que aguantarse.
    if ((phase === "bite" || nibbling()) && (taps.e || (Phaser.Input.Keyboard.JustDown(this.space) && !focusOwnsKey(" ")))) return hookFish();
    if (taps.e && phase === "waiting") return fishingSpotAction();
  }

  /** Clic en el mapa: mientras se pesca no camina (en la picada, responde). */
  pointerDown(): boolean {
    if (!this.busy) return false;
    if (useFishingStore.getState().phase === "bite" || nibbling()) hookFish();
    return true;
  }

  /** Se reconectó o cambió de nivel: se suelta todo. */
  reset() {
    this.stopMinigame();
    if (this.busy) useFishingStore.getState().setPhase("idle");
  }

  update(delta: number) {
    const { phase } = useFishingStore.getState();
    if (TRANSITIONAL.includes(phase) && phase !== "finishing" && performance.now() - this.phaseSince > STUCK_MS) {
      useFishingStore.getState().setPhase("idle");
      return;
    }
    if (phase === "finishing" && performance.now() - this.phaseSince > STUCK_MS) useFishingStore.getState().setPhase("idle");
    if (!this.sim) return;
    const sim = this.sim;
    if (!sim.done) {
      const { typing, pcOn } = useOfficeStore.getState();
      // Espacio con un botón de la UI enfocado es del botón, no de la caña.
      const holding = !typing && !pcOn && ((this.space.isDown && !focusOwnsKey(" ")) || this.scene.input.activePointer.isDown);
      this.acc += delta;
      let steps = 0;
      while (this.acc >= SIM_FRAME_MS && steps < MAX_STEPS && !sim.done) {
        if (holding !== this.hold) {
          this.inputs.push(sim.frame);
          this.hold = holding;
        }
        sim.step(this.hold);
        this.acc -= SIM_FRAME_MS;
        steps++;
        this.t++;
        if (this.hold && this.t % 6 === 0) playFishSound("reel");
      }
      if (steps === MAX_STEPS) this.acc = 0;
      if (sim.done) this.endedAt = performance.now();
    } else if (!this.sent && performance.now() - this.endedAt > RESULT_MS) {
      this.sent = true;
      sendFishResult(sim.frame, this.inputs);
    }
    this.draw();
  }

  destroy() {
    this.unsubscribe();
    this.stopMinigame();
  }

  private startMinigame() {
    const challenge = useFishingStore.getState().challenge;
    if (!challenge) return;
    this.stopMinigame();
    this.sim = new FishingSim(challenge);
    this.inputs = [];
    this.hold = false;
    this.acc = 0;
    this.t = 0;
    this.sent = false;
    const key = "pesca-minijuego";
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.tex = this.scene.textures.createCanvas(key, FISHING_BAR.w, FISHING_BAR.h) ?? undefined;
    this.img = this.scene.add.image(0, 0, key).setOrigin(0, 1).setDepth(MINIGAME_DEPTH);
    // Aparece de un saltito.
    this.img.setScale(1, 0.2);
    this.scene.tweens.add({ targets: this.img, scaleY: 1, duration: 160, ease: "Back.out" });
    this.draw();
  }

  private stopMinigame() {
    this.sim = undefined;
    this.img?.destroy();
    this.img = undefined;
    this.tex = undefined;
  }

  private draw() {
    const sim = this.sim;
    const me = this.local();
    if (!sim || !this.tex || !this.img || !me) return;
    const challenge = useFishingStore.getState().challenge;
    drawFishingBar(
      {
        track: SIM.track,
        fishSize: SIM.fish,
        barPos: sim.barPos,
        barHeight: sim.barHeight,
        fishPos: sim.fishPos,
        fishInBar: sim.fishInBar,
        meter: sim.meter,
        rarity: challenge?.rarity ?? "comun",
        treasure: sim.treasureVisible || (sim.treasureCaught && !sim.done)
          ? { pos: sim.treasurePos, size: SIM.treasureSize, meter: sim.treasureMeter, inBar: sim.treasureInBar }
          : null,
        t: this.t,
        holding: this.hold,
        result: sim.done ? (sim.caught ? "caught" : "escaped") : null,
      },
      this.px,
    );
    const ctx = this.tex.getContext();
    ctx.putImageData(new ImageData(new Uint8ClampedArray(this.px.data), FISHING_BAR.w, FISHING_BAR.h), 0, 0);
    this.tex.refresh();
    // Al costado del personaje, del lado contrario a donde cae la boya.
    const s = worldToScreen(me.x, me.y);
    const dir = castTarget(this.map(), me.x, me.y)?.dir ?? "right";
    const left = SCREEN_DIR[dir].x > 0;
    const x = Math.round(s.x) + (left ? -20 - FISHING_BAR.w : 20);
    this.img.setPosition(x, Math.round(s.y) + 10);
  }
}
