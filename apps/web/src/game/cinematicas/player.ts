// El reproductor de cinemáticas (VIR-155): corre los pasos de una cinemática de @hyvento/shared en orden
// sobre la escena de Phaser (cámara, actores, efectos y sonidos) y en React (franjas, títulos, el cuadro de
// diálogo y las opciones, ver store.ts). Una a la vez: una de historia corta lo que haya; un momento que
// llega mientras se ve otra cosa se pierde (son cortos y no cambian nada). Al terminar o al saltarla, la
// cámara vuelve al jugador y los NPC a su puesto. Se pide por puerta.ts (sin Phaser), donde se registra.
import { FRAME } from "@hyvento/map/art";
import {
  ALL_NPCS,
  CINE_MS,
  CINE_ME,
  PESCA_NPC,
  RECEPCION_NPC,
  fillCine,
  type CineDef,
  type CineStep,
  type Direction,
  type GameNpc,
} from "@hyvento/shared";
import * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { Avatar } from "../Avatar";
import { worldToScreen } from "../iso/view";
import { ensureCharacterTextures } from "../looks";
import { playCineSound } from "./sonidos";
import { cinePrefAllows, firstChoiceOf, runCineAction, setCineRunner } from "./puerta";
import { advance, choose, nextKey, setSkipHandler, useCineStore, waitAdvance, waitChoice } from "./store";

/** Lo que la escena le presta al reproductor. */
export interface CineHost {
  scene: Phaser.Scene;
  /** Mi personaje. */
  local(): Avatar | null;
  /** Un NPC dibujado en el nivel que se ve (o null si no está aquí). */
  npc(id: string): Avatar | null;
  tileSize(): number;
  /** La cámara vuelve a seguirme. */
  followLocal(): void;
}

let host: CineHost | null = null;

export function bindCineHost(h: CineHost | null) {
  host = h;
  setCineRunner(h ? reproducir : null);
}

const NPC_BY_ID = new Map<string, GameNpc>([...ALL_NPCS, PESCA_NPC, RECEPCION_NPC].map((n) => [n.id, n]));

const FLASH: Record<string, [number, number, number]> = { oro: [255, 214, 120], blanco: [255, 255, 255], rosa: [255, 170, 200] };
const CONFETTI = [
  [235, 87, 87],
  [242, 201, 76],
  [111, 207, 151],
  [86, 204, 242],
  [187, 107, 217],
] as const;

// ---------- Retratos ----------

const portraits = new Map<string, string>();

/** Recorte del retrato dentro de un cuadro de la hoja: la cabeza y los hombros (el chibi va centrado y abajo). */
const PORTRAIT = { x: Math.round(FRAME * 0.2), y: Math.round(FRAME * 0.22), size: Math.round(FRAME * 0.6) };

/** La cabeza y los hombros del personaje (cuadro de frente de su hoja), como data URL. */
function portraitFromSheet(scene: Phaser.Scene, key: string): string | null {
  const cached = portraits.get(key);
  if (cached) return cached;
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const { x, y, size } = PORTRAIT;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  // La hoja tiene 3 cuadros por fila; la fila de arriba mira hacia abajo (de frente) y el del medio está quieto.
  ctx.drawImage(src, FRAME + x, y, size, size, 0, 0, size, size);
  const url = c.toDataURL();
  portraits.set(key, url);
  return url;
}

// ---------- El reproductor ----------

const sleep = (ms: number, run: Run) =>
  new Promise<void>((resolve) => {
    if (run.skipping || ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    run.wakers.add(() => {
      clearTimeout(t);
      resolve();
    });
  });

interface Run {
  def: CineDef;
  vars: Readonly<Record<string, string | number>>;
  skipping: boolean;
  wakers: Set<() => void>;
  extras: Map<string, Avatar>;
  /** Dónde estaban los NPC que se movieron (vuelven al terminar). */
  moved: Map<Avatar, { x: number; y: number; dir: Direction }>;
  baseZoom: number;
  choice: string | null;
}

let current: Run | null = null;

/** Reproduce una cinemática (lo llama puerta.ts con la escena lista). */
async function reproducir(def: CineDef, vars: Readonly<Record<string, string | number>>): Promise<string | null> {
  const firstChoice = firstChoiceOf(def);
  if (!host || !cinePrefAllows(def)) return firstChoice;
  if (current) {
    // Un momento no interrumpe nada; una de historia corta lo que se estaba viendo.
    if (def.kind === "momento") return null;
    skipCurrent();
    await new Promise((r) => setTimeout(r, 0));
  }
  const cam = host.scene.cameras.main;
  const run: Run = { def, vars, skipping: false, wakers: new Set(), extras: new Map(), moved: new Map(), baseZoom: cam.zoom, choice: null };
  current = run;
  useCineStore.setState({ playing: { id: def.id, kind: def.kind }, bars: false, title: null, line: null, choice: null, lastSaid: "" });
  setSkipHandler(skipCurrent);
  try {
    for (const step of def.steps) {
      if (run.skipping && step.op !== "choice") continue;
      await runStep(run, step);
    }
  } finally {
    finish(run);
  }
  return run.choice ?? firstChoice;
}

function skipCurrent() {
  const run = current;
  if (!run || run.skipping) return;
  run.skipping = true;
  for (const wake of run.wakers) wake();
  run.wakers.clear();
  advance();
  const opts = useCineStore.getState().choice?.options;
  if (opts?.[0]) choose(opts[0].id);
}

function finish(run: Run) {
  if (current !== run) return;
  current = null;
  setSkipHandler(null);
  useCineStore.setState({ playing: null, bars: false, title: null, line: null, choice: null });
  const h = host;
  if (!h) return;
  for (const a of run.extras.values()) a.destroy();
  for (const [a, p] of run.moved) {
    a.setPosition(p.x, p.y);
    a.face(p.dir);
  }
  const cam = h.scene.cameras.main;
  cam.resetFX();
  if (cam.zoom !== run.baseZoom) cam.zoomTo(run.baseZoom, lessMotion() ? 0 : 400, "Sine.easeInOut", true);
  h.followLocal();
}

function actor(run: Run, who: string): Avatar | null {
  if (!host) return null;
  if (who === CINE_ME) return host.local();
  return run.extras.get(who) ?? host.npc(who);
}

function portraitOf(run: Run, who: string): string | null {
  const h = host;
  if (!h || who === "narrador") return null;
  const a = actor(run, who);
  if (a) return portraitFromSheet(h.scene, a.sprite.texture.key.replace(/-sit$/, ""));
  const npc = NPC_BY_ID.get(who);
  return npc ? portraitFromSheet(h.scene, ensureCharacterTextures(h.scene, "ada", npc.look)) : null;
}

function nameOf(run: Run, who: string, explicit?: string): string {
  if (explicit !== undefined) return fillCine(explicit, run.vars);
  if (who === "narrador") return "";
  if (who === CINE_ME) return "Tú";
  return NPC_BY_ID.get(who)?.name ?? "";
}

function screenOf(run: Run, to: string | { x: number; y: number }): { x: number; y: number } | null {
  if (typeof to === "string") {
    const a = actor(run, to);
    return a ? worldToScreen(a.x, a.y) : null;
  }
  const ts = host!.tileSize();
  return worldToScreen(to.x * ts + ts / 2, to.y * ts + ts / 2);
}

function facingTo(dx: number, dy: number): Direction {
  const sx = dx - dy;
  const sy = dx + dy;
  return sy >= 0 ? (sx >= 0 ? "right" : "down") : sx >= 0 ? "up" : "left";
}

async function runStep(run: Run, step: CineStep) {
  const h = host;
  if (!h) return;
  const cam = h.scene.cameras.main;
  const calm = lessMotion();
  const text = (t: string) => fillCine(t, run.vars);
  switch (step.op) {
    case "bars":
      useCineStore.setState({ bars: step.on });
      return sleep(350, run);
    case "fade": {
      const ms = step.ms ?? CINE_MS.fade;
      if (step.to === "clear") cam.fadeIn(ms);
      else if (step.to === "white") cam.fadeOut(ms, 255, 255, 255);
      else cam.fadeOut(ms, 0, 0, 0);
      return sleep(ms, run);
    }
    case "flash": {
      if (calm) return;
      const [r, g, b] = FLASH[step.color ?? "oro"]!;
      cam.flash(step.ms ?? CINE_MS.flash, r, g, b);
      return;
    }
    case "camera": {
      const p = screenOf(run, step.to);
      if (!p) return;
      const ms = calm ? 0 : (step.ms ?? CINE_MS.camera);
      if (step.to === CINE_ME) {
        if (cam.zoom !== run.baseZoom) cam.zoomTo(run.baseZoom, ms, "Sine.easeInOut", true);
        cam.pan(p.x, p.y, ms, "Sine.easeInOut", true);
        await sleep(ms, run);
        h.followLocal();
        return;
      }
      cam.stopFollow();
      cam.pan(p.x, p.y, ms, "Sine.easeInOut", true);
      if (step.zoom) cam.zoomTo(run.baseZoom * step.zoom, ms, "Sine.easeInOut", true);
      return sleep(ms, run);
    }
    case "shake":
      if (!calm) cam.shake(step.ms ?? CINE_MS.shake, step.strength ?? 0.003);
      return;
    case "say": {
      const wait = run.def.kind === "historia";
      const said = text(step.text);
      useCineStore.setState({
        line: { name: nameOf(run, step.who, step.name), text: said, portrait: portraitOf(run, step.who), wait, key: nextKey() },
        lastSaid: said,
      });
      if (wait) {
        await Promise.race([waitAdvance(), new Promise<void>((r) => run.wakers.add(r))]);
      } else await sleep(step.ms ?? CINE_MS.sayMoment, run);
      useCineStore.setState({ line: null });
      return;
    }
    case "bubble":
      actor(run, step.who)?.say(text(step.text));
      return;
    case "title":
      useCineStore.setState({ title: { text: text(step.text), sub: step.sub ? text(step.sub) : undefined, key: nextKey() } });
      await sleep(step.ms ?? CINE_MS.title, run);
      useCineStore.setState({ title: null });
      return;
    case "walk": {
      const a = actor(run, step.who);
      if (!a) return;
      const ts = h.tileSize();
      const from = { x: a.x, y: a.y };
      const to = { x: step.to.x * ts + ts / 2, y: step.to.y * ts + ts / 2 };
      if (!run.moved.has(a) && !run.extras.has(step.who)) run.moved.set(a, { ...from, dir: a.direction });
      const dir = facingTo(to.x - from.x, to.y - from.y);
      const ms = calm ? 0 : (step.ms ?? CINE_MS.walk);
      if (ms === 0) {
        a.setPosition(to.x, to.y);
        a.face(dir);
        return;
      }
      a.setMotion(dir, true);
      await new Promise<void>((resolve) => {
        const tween = h.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: ms,
          onUpdate: (tw) => {
            const v = tw.getValue() ?? 0;
            a.setPosition(from.x + (to.x - from.x) * v, from.y + (to.y - from.y) * v);
          },
          onComplete: () => resolve(),
        });
        run.wakers.add(() => {
          tween.stop();
          a.setPosition(to.x, to.y);
          resolve();
        });
      });
      a.setMotion(dir, false);
      return;
    }
    case "face":
      actor(run, step.who)?.face(step.dir);
      return;
    case "emote":
      actor(run, step.who)?.emote(step.emote);
      return sleep(400, run);
    case "gesture":
      actor(run, step.who)?.playGesture(step.kind);
      return;
    case "spawn": {
      const npc = NPC_BY_ID.get(step.like);
      if (!npc) return;
      const ts = h.tileSize();
      const key = ensureCharacterTextures(h.scene, "ada", npc.look);
      const a = new Avatar(h.scene, key, step.name ?? npc.name, step.at.x * ts + ts / 2, step.at.y * ts + ts / 2, false);
      a.asNpc();
      if (step.facing) a.face(step.facing);
      run.extras.set(step.id, a);
      return;
    }
    case "despawn":
      run.extras.get(step.id)?.destroy();
      run.extras.delete(step.id);
      return;
    case "sound":
      playCineSound(step.sound);
      return;
    case "fx": {
      const a = actor(run, step.who ?? CINE_ME);
      if (!a || calm) return;
      if (step.fx === "confeti") a.confetti(CONFETTI);
      else if (step.fx === "chispas") a.sparkle();
      else if (step.fx === "celebrar") a.celebrate();
      else if (step.fx === "corazones") a.emote("heart");
      else {
        a.sparkle();
        a.celebrate();
      }
      return;
    }
    case "wait":
      return sleep(step.ms, run);
    case "choice": {
      if (run.skipping) {
        run.choice = step.options[0]?.id ?? null;
        return;
      }
      useCineStore.setState({ choice: { prompt: step.prompt ? text(step.prompt) : undefined, options: step.options } });
      const id = await waitChoice();
      useCineStore.setState({ choice: null });
      run.choice = id;
      const action = step.options.find((o) => o.id === id)?.action;
      if (action) runCineAction(action);
      return;
    }
  }
}
