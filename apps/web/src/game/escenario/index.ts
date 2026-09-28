// El escenario y la cabina de grabación en la escena: la pantalla compartida de quien habla en la tarima
// proyectada sobre la tela de la concha, las manos levantadas sobre las cabezas, los aplausos (y la
// ovación), el cartel "EN EL AIRE" prendido para todos mientras se graba y el grabador del navegador de
// quien pidió grabar. La escena solo tiene ganchos chicos: setArea, update y destroy.
import { zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { podcastSign, STAGE_SCREEN, WORLD_TO_ART } from "@hyvento/map/art";
import { ESCENARIO, PODCAST } from "@hyvento/shared";
import type { Track } from "livekit-client";
import type * as Phaser from "phaser";
import { COZY, cozyFontFamily } from "@/lib/cozy";
import type { Avatar } from "../Avatar";
import { depthOf, ensureTexture, worldToScreen } from "../iso/view";
import { media, useMediaStore } from "../media";
import { getRoom } from "../network";
import { sfx } from "../sfx";
import { selectMyUserId, useOfficeStore } from "../store";
import { sceneToCss, WallMount, type ScreenQuad } from "../wallMount";
import { onApplause, sendPodcastStop } from "./net";
import { PodcastRecorder } from "./recorder";
import { useEscenarioStore } from "./store";

/** Cada cuánto el grabador revisa qué voces mezclar (alguien prendió o apagó el micrófono). */
const RECORDER_SYNC_MS = 1000;
/** Pausa entre dos "¡Bravo!" sobre la tarima. */
const OVATION_GAP_MS = 5000;

interface Hosts {
  scene: Phaser.Scene;
  local: () => Avatar | undefined;
  avatars: () => ReadonlyMap<string, Avatar>;
}

export class EscenarioMode {
  private map?: OfficeMap;
  private shell?: PlacedFurniture;
  private booth?: PlacedFurniture;
  /** La pantalla compartida montada sobre la tela (de quién es, la pista, el <video> y el recuadro). */
  private screen: { track: Track; el: HTMLVideoElement; mount: WallMount } | null = null;
  private sign?: { img: Phaser.GameObjects.Image; key: string };
  private recorder: PodcastRecorder | null = null;
  private recorderSyncIn = 0;
  private lastOvation = 0;
  private lastTime = 0;
  private detach: () => void;

  constructor(private readonly h: Hosts) {
    this.detach = onApplause((e) => {
      const map = this.map;
      if (!map || map.id !== ESCENARIO.area) return;
      const here = useEscenarioStore.getState().here;
      const near = here.onStage || here.inSeats;
      sfx.applause(near ? 1 : 0.35, e.crowd);
      if (e.crowd >= ESCENARIO.ovationCrowd && performance.now() - this.lastOvation > OVATION_GAP_MS) {
        this.lastOvation = performance.now();
        this.ovation();
      }
    });
  }

  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
    if (map.id !== ESCENARIO.area) return;
    this.shell = map.furniture.find((f) => f.type === "stage-shell");
    this.booth = map.furniture.find((f) => f.type === "podcast-booth-roof");
    if (this.booth) {
      const ts = map.tileSize;
      const img = this.h.scene.add.image(0, 0, "__DEFAULT").setVisible(false).setDepth(depthOf((this.booth.x + this.booth.w / 2) * ts, (this.booth.y + this.booth.d / 2) * ts) + 0.05);
      this.sign = { img, key: "" };
    }
  }

  update(time: number) {
    const dt = this.lastTime ? Math.min(200, time - this.lastTime) : 16;
    this.lastTime = time;
    const map = this.map;
    const room = getRoom();
    const office = useOfficeStore.getState();
    const myId = selectMyUserId(office);
    const store = useEscenarioStore.getState();
    const me = this.h.local();
    const zone = me && map ? (zoneAt(map, me.x, me.y)?.id ?? null) : null;
    const inJardin = map?.id === ESCENARIO.area;
    const boothNames: string[] = [];
    room?.state.players.forEach((p) => {
      if (p.area === PODCAST.area && p.zoneId === PODCAST.zone) boothNames.push(p.name);
    });
    store.setHere({ onStage: inJardin && zone === ESCENARIO.stageZone, inSeats: inJardin && zone === ESCENARIO.seatsZone, inBooth: inJardin && zone === PODCAST.zone }, boothNames);

    // Las manos levantadas, con su turno (solo se ven en el jardín: los avatares de otros niveles se ocultan).
    const order = new Map(store.hands.map((hand, i) => [hand.sessionId, i + 1]));
    for (const [sessionId, avatar] of this.h.avatars()) avatar.setHand(inJardin ? (order.get(sessionId) ?? null) : null);

    this.updateRecorder(dt, myId);
    if (!inJardin || !map) return;
    this.updateScreen(map, myId);
    this.updateSign(time);
  }

  destroy() {
    this.detach();
    this.clear();
    this.recorder?.stop();
    this.recorder = null;
    useEscenarioStore.getState().setRecording(false);
  }

  // ---------- Pantalla grande ----------

  /** Quien habla (en la tarima o con la palabra) y comparte pantalla: la suya va a la tela de la concha. */
  private speakerScreen(myId: string | null): { identity: string | null; track: Track } | undefined {
    const m = useMediaStore.getState();
    const { floor, here } = useEscenarioStore.getState();
    if (m.screen && (here.onStage || (floor !== "" && floor === myId))) {
      const track = media.videoTrack(null, "screen");
      return track && { identity: null, track };
    }
    let found: { identity: string | null; track: Track } | undefined;
    getRoom()?.state.players.forEach((p) => {
      if (found || p.area !== ESCENARIO.area || p.userId === myId) return;
      if (p.zoneId !== ESCENARIO.stageZone && p.userId !== floor) return;
      if (!m.participants[p.userId]?.screen) return;
      const track = media.videoTrack(p.userId, "screen");
      if (track) found = { identity: p.userId, track };
    });
    return found;
  }

  private updateScreen(map: OfficeMap, myId: string | null) {
    const speaker = this.speakerScreen(myId);
    if (this.screen && this.screen.track !== speaker?.track) this.dropScreen();
    const parent = this.h.scene.game.canvas.parentElement;
    if (!speaker || !parent || !this.shell) return;
    const { identity, track } = speaker;
    if (!this.screen) {
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      Object.assign(el.style, { width: "100%", height: "100%", objectFit: "contain", background: "#000", display: "block" } satisfies Partial<CSSStyleDeclaration>);
      const mount = new WallMount(parent, {
        id: "escenario",
        onClick: () => useMediaStore.getState().setFocused({ identity, source: "screen" }),
        titles: { small: "Ver la presentación en grande", big: "" },
      });
      mount.frame.appendChild(el);
      track.attach(el);
      this.screen = { track, el, mount };
    }
    this.screen.mount.place(this.quad(map, parent), false);
  }

  /** Dónde cae la tela de la concha en la pantalla (en px del contenedor), o null si está fuera de la vista. */
  private quad(map: OfficeMap, parent: HTMLElement): ScreenQuad | null {
    const f = this.shell!;
    const ts = map.tileSize;
    const toWorld = (u: number) => u / WORLD_TO_ART;
    const x = f.x * ts + toWorld(STAGE_SCREEN.x);
    const at = (y: number, z: number) => sceneToCss(this.h.scene, worldToScreen(x, f.y * ts + toWorld(y), z));
    const { y0, y1, z0, z1 } = STAGE_SCREEN;
    // En pantalla el sur (+y) queda a la izquierda.
    const q = { tl: at(y1, z1), tr: at(y0, z1), bl: at(y1, z0), aspect: (y1 - y0) / (z1 - z0) };
    const xs = [q.tl.x, q.tr.x, q.bl.x];
    const ys = [q.tl.y, q.tr.y, q.bl.y];
    const off = Math.max(...xs) < 0 || Math.min(...xs) > parent.clientWidth || Math.max(...ys) < -40 || Math.min(...ys) > parent.clientHeight;
    return off ? null : q;
  }

  private dropScreen() {
    if (!this.screen) return;
    this.screen.track.detach(this.screen.el);
    this.screen.mount.destroy();
    this.screen = null;
  }

  // ---------- Cartel y ovación ----------

  private updateSign(time: number) {
    const sign = this.sign;
    const booth = this.booth;
    if (!sign || !booth || !this.map) return;
    const lit = useEscenarioStore.getState().podcast.phase === "recording";
    sign.img.setVisible(lit);
    if (!lit) return;
    const frame = Math.floor(time / 700) % 2;
    const key = `podcast-cartel-${frame}`;
    if (sign.key === key) return;
    const s = podcastSign(true, frame);
    ensureTexture(this.h.scene, key, () => s.canvas);
    const ts = this.map.tileSize;
    const a = worldToScreen(booth.x * ts, booth.y * ts);
    sign.img.setTexture(key).setOrigin(0, 0).setPosition(Math.round(a.x - s.ox), Math.round(a.y - s.oy));
    sign.key = key;
  }

  /** "¡Bravo!" sobre la tarima cuando aplaude mucha gente a la vez. */
  private ovation() {
    const map = this.map;
    const f = this.shell;
    if (!map || !f) return;
    const ts = map.tileSize;
    const p = worldToScreen((f.x + 4.5) * ts, (f.y + f.d / 2) * ts, 70);
    const text = this.h.scene.add
      .text(Math.round(p.x), Math.round(p.y), "¡Bravo!", { fontFamily: cozyFontFamily(), fontSize: "12px", color: COZY.red, backgroundColor: COZY.paperLight, padding: { x: 4, y: 2 }, resolution: 6 })
      .setOrigin(0.5, 1)
      .setDepth(6.5e7)
      .setScale(0.4);
    this.h.scene.tweens.add({ targets: text, scale: 1, y: p.y - 14, duration: 500, ease: "Back.out" });
    this.h.scene.tweens.add({ targets: text, alpha: 0, delay: 1800, duration: 500, onComplete: () => text.destroy() });
  }

  // ---------- Grabador ----------

  /**
   * Graba en este navegador solo si el servidor dice que se está grabando y yo lo pedí. Si algo cambia
   * (alguien dijo que no, entró otra persona, salí), el servidor lo detiene y aquí se arma el archivo.
   */
  private updateRecorder(dt: number, myId: string | null) {
    const { podcast, setRecording } = useEscenarioStore.getState();
    const mine = podcast.phase === "recording" && myId !== null && podcast.host === myId;
    if (mine && !this.recorder) {
      const rec = media.connected ? PodcastRecorder.start(Date.now()) : null;
      if (!rec) {
        useOfficeStore.getState().notify(media.connected ? "Este navegador no puede grabar audio." : "Para grabar hay que tener el audio conectado.", "warning");
        sendPodcastStop();
        return;
      }
      this.recorder = rec;
      this.recorderSyncIn = 0;
      setRecording(true);
    }
    if (!mine && this.recorder) {
      this.recorder.stop();
      this.recorder = null;
      setRecording(false);
      useOfficeStore.getState().notify("Grabación terminada: el archivo se descargó en tu computador.", "success");
      return;
    }
    if (!this.recorder) return;
    this.recorderSyncIn -= dt;
    if (this.recorderSyncIn > 0) return;
    this.recorderSyncIn = RECORDER_SYNC_MS;
    // Mi voz y las de los demás de adentro (a ellos los oigo: estamos en la misma sala aislada).
    const voices: (string | null)[] = [null];
    getRoom()?.state.players.forEach((p) => {
      if (p.userId !== myId && p.area === PODCAST.area && p.zoneId === PODCAST.zone) voices.push(p.userId);
    });
    this.recorder.sync(voices);
  }

  private clear() {
    this.dropScreen();
    this.sign?.img.destroy();
    this.sign = undefined;
    this.shell = undefined;
    this.booth = undefined;
    for (const avatar of this.h.avatars().values()) avatar.setHand(null);
  }
}
