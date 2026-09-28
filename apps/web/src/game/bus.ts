// El Megabús en pantalla: en el jardín, el bus articulado que entra por la calle, frena en la estación,
// abre puertas y se va (cada cuerpo se corre con su propio carril: así se dobla en el fuelle), las puertas
// de vidrio de la estación y la pantalla de "Próximo bus". Adentro del bus (nivel `megabus`), los sonidos
// del viaje. Todo sale de `state.bus` (la fase y cuándo empezó) y de la hora del servidor: no hay reglas
// acá (las valida apps/server/src/rooms/bus.ts).
import { BUS_ROUTE, BUS_STOP, ROAD, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { busCarSprite, busJointSprite, busScreenText, stationDoorsSprite, type BusCar, type Sprite } from "@hyvento/map/art";
import { BUS, BUS_TIMINGS, busEtaMs, busLane, busOffset, doorsOpening, nextBusText, type BusPhase } from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import * as Phaser from "phaser";
import { playBusBrakes, playBusDoors, setBusEngine } from "./busSonidos";
import { readBus, useBusStore } from "./busStore";
import { serverNow } from "./club/store";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";
import type { OfficeRoom } from "./network";
import { volAt } from "./sfx";
import { useOfficeStore } from "./store";

/** Transparencia de la estación con alguien adentro (la misma del techo, ver jardinVivo.ts). */
const SEE_THROUGH = 0.35;
/** Hasta dónde se oye el bus (px de mundo: unos 18 tiles; es grande y ruidoso). */
const HEAR_PX = 32 * 18;
/** Cuadros de las puertas (0 cerradas … DOOR_FRAMES abiertas). */
const DOOR_FRAMES = 4;
/** Dónde queda el origen del mundo en cada dibujo del bus (por clave de textura). */
const ORIGINS = new Map<string, { ox: number; oy: number }>();

const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** El bus aparece y se pierde en el bosque de las puntas de la calle. */
const fadeAt = (cx: number) => smooth(ROAD.x0 - 2, ROAD.x0 + 5, cx) * (1 - smooth(ROAD.x1 - 5, ROAD.x1 + 2, cx));

export class BusView {
  private map?: OfficeMap;
  private station?: PlacedFurniture;
  private cars?: { front: Phaser.GameObjects.Image; joint: Phaser.GameObjects.Image; rear: Phaser.GameObjects.Image };
  private doors?: Phaser.GameObjects.Image;
  private screen?: Phaser.GameObjects.Image;
  private shownScreen = "";
  private shownDoors = "";
  private stationAlpha = 1;
  private lastPhase: BusPhase | "" = "";
  private brakedRun = -1;
  private detach: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly room: () => OfficeRoom | undefined,
  ) {}

  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
    this.station = map.furniture.find((f) => f.type === "bus-station");
    if (!this.station) return;
    const img = () => this.scene.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    this.cars = { front: img(), joint: img(), rear: img() };
    this.doors = img();
    this.screen = img();
  }

  bind(room: OfficeRoom) {
    this.unbind();
    const $ = getStateCallbacks(room);
    const sync = () => useBusStore.getState().set(readBus(room.state.bus));
    this.detach.push(
      $(room.state).listen("bus", (b) => {
        if (!b) return;
        this.detach.push(($(b as never) as unknown as { onChange(cb: () => void): () => void }).onChange(sync));
        sync();
      }),
    );
  }

  unbind() {
    this.detach.forEach((d) => d());
    this.detach = [];
  }

  destroy() {
    this.unbind();
    this.clear();
    setBusEngine(0, 0);
  }

  private clear() {
    for (const o of [this.cars?.front, this.cars?.joint, this.cars?.rear, this.doors, this.screen]) o?.destroy();
    this.cars = this.doors = this.screen = undefined;
    this.shownScreen = this.shownDoors = "";
    this.station = undefined;
  }

  /** Pone un dibujo con su origen en el tile (x, y) del nivel. */
  private place(img: Phaser.GameObjects.Image, key: string, make: () => Sprite, tx: number, ty: number, depth: number) {
    let o = ORIGINS.get(key);
    if (!o || !this.scene.textures.exists(key)) {
      const s = make();
      ensureTexture(this.scene, key, () => s.canvas);
      ORIGINS.set(key, (o = { ox: s.ox, oy: s.oy }));
    }
    const ts = this.map!.tileSize;
    const a = worldToScreen(tx * ts, ty * ts);
    if (img.texture.key !== key) img.setTexture(key);
    img.setPosition(Math.round(a.x - o.ox), Math.round(a.y - o.oy)).setDepth(depth).setVisible(true);
  }

  update(delta: number) {
    const map = this.map;
    const room = this.room();
    if (!map || !room) return;
    const b = useBusStore.getState();
    const now = serverNow();
    const elapsed = now - b.since;
    const night = useOfficeStore.getState().night;
    if (map.id === BUS.area) return this.updateInside(b.phase, elapsed);
    if (!this.station || !this.cars) return;
    const ts = map.tileSize;
    const st = this.station;

    // La estación: sus puertas y la pantalla, transparentes como ella cuando hay alguien adentro.
    let inside = false;
    for (const p of room.state.players.values())
      if (p.area === map.id && p.x >= st.x * ts && p.x < (st.x + st.w) * ts && p.y >= st.y * ts && p.y < (st.y + st.d) * ts) inside = true;
    this.stationAlpha += ((inside ? SEE_THROUGH : 1) - this.stationAlpha) * Math.min(1, delta / 180);
    const stDepth = depthOf((st.x + st.w / 2) * ts, (st.y + st.d / 2) * ts);
    const k = Math.round(doorsOpening(b.phase, elapsed, BUS_TIMINGS) * DOOR_FRAMES);
    const dkey = `bus-puertas-${k}-${night ? "noche" : "dia"}`;
    if (dkey !== this.shownDoors) {
      this.shownDoors = dkey;
      this.place(this.doors!, dkey, () => stationDoorsSprite(k / DOOR_FRAMES, night), st.x, st.y, stDepth + 0.2);
    }
    const text = nextBusText(b.phase, busEtaMs(b.phase, b.since, b.nextAt, now, BUS_TIMINGS));
    const skey = `bus-pantalla-${text}-${night ? "noche" : "dia"}`;
    if (skey !== this.shownScreen) {
      this.shownScreen = skey;
      this.place(this.screen!, skey, () => busScreenText(text, night), st.x, st.y, stDepth + 0.3);
    }
    this.doors!.setAlpha(this.stationAlpha);
    this.screen!.setAlpha(this.stationAlpha);

    // El bus: dónde va el frente y cada cuerpo con su carril.
    const s = busOffset(b.phase, elapsed, BUS_TIMINGS, BUS_STOP.stopX - BUS_ROUTE.startX, BUS_ROUTE.endX - BUS_STOP.stopX);
    this.sounds(b.phase, b.run, elapsed, s);
    const { front, joint, rear } = this.cars;
    if (s === null) {
      for (const o of [front, joint, rear]) o.setVisible(false);
      return;
    }
    const frontX = BUS_STOP.stopX + s;
    const latF = busLane(s - BUS.frontLen / 2) * BUS_STOP.laneShift;
    const latR = busLane(s - BUS.frontLen - BUS.jointLen - BUS.rearLen / 2) * BUS_STOP.laneShift;
    const jointX = frontX - BUS.frontLen - BUS.jointLen;
    const rearX = jointX - BUS.rearLen;
    // El bus va por delante de la estación y de quien espera en la plataforma (nada se camina al sur).
    const depth = (x: number) => depthOf(x * ts, (ROAD.y0 + 12) * ts);
    const car = (img: Phaser.GameObjects.Image, which: BusCar, x: number, lat: number, len: number) => {
      const key = `bus-${which}-${k}-${night ? "noche" : "dia"}`;
      this.place(img, key, () => busCarSprite(which, night, k / DOOR_FRAMES), x, BUS_STOP.sideY + lat, depth(x + len));
      img.setAlpha(fadeAt(x + len / 2));
    };
    car(rear, "rear", rearX, latR, BUS.rearLen);
    const dy = Math.round((latR - latF) * 16);
    this.place(joint, `bus-fuelle-${dy}`, () => busJointSprite(dy), jointX, BUS_STOP.sideY + latF, depth(jointX + BUS.jointLen) + 0.1);
    joint.setAlpha(fadeAt(jointX));
    car(front, "front", frontX - BUS.frontLen, latF, BUS.frontLen);
  }

  /** El motor, los frenos y las puertas en el jardín, según dónde va el bus y quién lo oye. */
  private sounds(phase: BusPhase, run: number, elapsed: number, s: number | null) {
    const ts = this.map!.tileSize;
    const x = (BUS_STOP.stopX + (s ?? 0) - BUS.frontLen / 2) * ts;
    const y = (BUS_STOP.sideY + 1.3) * ts;
    const vol = s === null ? 0 : volAt(x, y, HEAR_PX) * fadeAt(x / ts);
    const t = BUS_TIMINGS;
    let rev = 0.15;
    if (phase === "arriving") rev = 1 - elapsed / t.approachMs;
    else if (phase === "leaving" || (phase === "route" && elapsed < t.departMs)) rev = Math.min(1, elapsed / t.departMs + 0.3);
    else if (phase === "route") rev = 1 - (elapsed - (t.tripMs - t.approachMs)) / t.approachMs;
    setBusEngine(vol * (phase === "open" || phase === "closing" ? 0.6 : 1), rev);
    // La frenada, una vez por llegada, al final del frenado.
    const braking = (phase === "arriving" && elapsed > t.approachMs - 1600) || (phase === "route" && elapsed > t.tripMs - 1600);
    const key = run * 2 + (phase === "route" ? 1 : 0);
    if (braking && this.brakedRun !== key) {
      this.brakedRun = key;
      playBusBrakes(vol);
    }
    this.doorSounds(phase, vol);
  }

  private doorSounds(phase: BusPhase, vol: number) {
    if (phase === this.lastPhase) return;
    const first = this.lastPhase === "";
    this.lastPhase = phase;
    if (first) return;
    if (phase === "open") playBusDoors(vol, true);
    else if (phase === "closing") playBusDoors(vol, false);
  }

  /** Adentro: el motor mientras va de camino y las puertas al llegar y al salir. */
  private updateInside(phase: BusPhase, elapsed: number) {
    const t = BUS_TIMINGS;
    const moving = phase === "arriving" || phase === "route" || phase === "leaving";
    const rev = phase === "route" ? 0.55 + 0.4 * Math.sin((elapsed / t.tripMs) * Math.PI) : phase === "arriving" ? 1 - elapsed / t.approachMs : 0.15;
    setBusEngine(moving ? 0.55 : 0.3, rev);
    const key = phase === "route" ? 1 : 0;
    const arrivingEnd = (phase === "arriving" && elapsed > t.approachMs - 1600) || (phase === "route" && elapsed > t.tripMs - 1600);
    if (arrivingEnd && this.brakedRun !== useBusStore.getState().run * 2 + key) {
      this.brakedRun = useBusStore.getState().run * 2 + key;
      playBusBrakes(0.6);
    }
    this.doorSounds(phase, 0.9);
  }
}

