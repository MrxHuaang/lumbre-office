// Un reproductor de YouTube (el iframe oficial, sin clave) encima del canvas: el del club y el del cine,
// montados sobre su pantalla de la pared, y el de la radio de las oficinas, que solo suena. No se mueve
// nunca de lugar en el DOM (moverlo lo recargaría): se estira con una matriz CSS para que caiga sobre la
// pared inclinada y, en grande, se centra (ver wallMount.ts). Va al segundo que le digan (la hora del
// servidor): todos ven lo mismo.
import { WallMount, type ScreenQuad } from "./wallMount";
import { mediaScale } from "./mixer";

export type { Point, ScreenQuad } from "./wallMount";

// ---------- API del iframe de YouTube ----------

interface YTPlayer {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  /** No está en la documentación, pero el reproductor la trae: `isLive` marca un video en vivo. */
  getVideoData?(): { isLive?: boolean; isWindowedLive?: boolean };
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Estados del reproductor (YT.PlayerState). */
const YT_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

let api: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  api ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      api = null;
      reject(new Error("No cargó el reproductor de YouTube"));
    };
    document.head.appendChild(s);
  });
  return api;
}

// ---------- Montaje sobre la pantalla ----------

/** Lo que tiene que sonar: `id` distingue dos veces el mismo video (la cola del club). */
export interface VideoEntry {
  id: string;
  videoId: string;
}

export interface VideoWant {
  entry: VideoEntry | null;
  /** En qué punto del video va (ms), con la hora del servidor. */
  elapsedMs: number;
  paused: boolean;
  /** 0 a 1; 0 = no se oye (fuera del club o en silencio). */
  volume: number;
  /** Dónde se ve; null = no se ve (pero puede seguir sonando). */
  quad: ScreenQuad | null;
  big: boolean;
}

/** Lo que cada dueño hace con los avisos del reproductor. */
export interface ScreenHooks {
  /** El reproductor dijo cuánto dura, o que terminó (el club pasa al siguiente). */
  onDuration?: (id: string, ms: number) => void;
  onEnded?: (id: string) => void;
  /** El video no se puede ver (código de error de YouTube). */
  onError?: (id: string, code: number) => void;
  /** El navegador no lo deja sonar solo: hace falta un toque. */
  onNeedsTap?: (needs: boolean) => void;
  /** Clic en la pantalla (el club la agranda). */
  onClick?: () => void;
  /** Al terminar vuelve a empezar (la radio de la oficina). */
  loop?: boolean;
  /** Títulos de la pantalla chica y de la grande. */
  titles?: { small: string; big: string };
  /** Marca del reproductor (uno por marca en la página; ver MountOptions.id). */
  id?: string;
  /** Borde de la vista en grande (el cine lo lleva dorado; el club, de neón). */
  bigFrame?: string;
}

/** Los reproductores vivos (el HUD los despierta con un toque sin cargar la escena). */
const active = new Set<YoutubeScreen>();
export const tapVideos = () => active.forEach((v) => v.tap());

/** Cada cuánto se revisa que el video vaya al segundo del servidor. */
const SYNC_MS = 700;
/** Desfase que se tolera antes de saltar al segundo correcto. */
const DRIFT_MS = 2000;
/** Si en este tiempo el video no arrancó solo, el navegador lo bloqueó: se pide un toque. */
const BLOCKED_MS = 3500;
/** Un video en vivo más atrás que esto del borde en directo se lleva al directo (una vez). */
const LIVE_BEHIND_S = 30;
/** YouTube no deja subir videos de más de 12 h: una "duración" mayor es lo que lleva una transmisión. */
const MAX_VOD_S = 12 * 3600;

export class YoutubeScreen {
  private mount: WallMount;
  private player: YTPlayer | null = null;
  private creating = false;
  private ready = false;
  /** La entrada que tiene cargada el reproductor. */
  private loaded: string | null = null;
  private loadedAt = 0;
  /**
   * El video cargado es en vivo: no tiene un "segundo del servidor" (su tiempo es el de la transmisión),
   * así que no se sincroniza; si no, cada revisión lo haría saltar y re-bufferear.
   */
  private live = false;
  /** La primera duración que dio el video cargado (la de uno en vivo crece: así se reconoce). */
  private firstDuration = 0;
  private reported = new Set<string>();
  private lastSync = 0;
  private lastVolume = -1;
  private want: VideoWant | null = null;

  constructor(
    parent: HTMLElement,
    private readonly hooks: ScreenHooks = {},
  ) {
    this.mount = new WallMount(parent, { id: hooks.id, onClick: hooks.onClick, titles: hooks.titles, bigFrame: hooks.bigFrame });
    this.mount.frame.appendChild(document.createElement("div"));
    active.add(this);
  }

  /** Cada frame: dónde se ve, cuánto suena y qué video y segundo tocan. */
  update(want: VideoWant) {
    this.want = want;
    this.mount.place(want.entry ? want.quad : null, Boolean(want.entry) && want.big);
    if (!want.entry) {
      if (this.loaded) {
        this.player?.stopVideo();
        this.loaded = null;
      }
      this.hooks.onNeedsTap?.(false);
      return;
    }
    if (!this.player) {
      void this.create();
      return;
    }
    if (!this.ready) return;
    // El volumen de la pantalla (su control propio y la distancia) por el de la música del mezclador.
    const volume = want.volume * mediaScale("music");
    if (this.lastVolume !== volume) {
      this.lastVolume = volume;
      if (volume <= 0) this.player.mute();
      else {
        this.player.unMute();
        this.player.setVolume(Math.round(volume * 100));
      }
    }
    const now = performance.now();
    if (now - this.lastSync < SYNC_MS && this.loaded === want.entry.id) return;
    this.lastSync = now;
    const expected = want.elapsedMs;
    if (this.loaded !== want.entry.id) {
      this.loaded = want.entry.id;
      this.loadedAt = now;
      this.live = false;
      this.firstDuration = 0;
      this.player.loadVideoById({ videoId: want.entry.videoId, startSeconds: Math.max(0, expected / 1000) });
      if (want.paused) this.player.pauseVideo();
      return;
    }
    const state = this.player.getPlayerState();
    const live = this.checkLive(state);
    const drift = live ? 0 : Math.abs(this.player.getCurrentTime() * 1000 - expected);
    if (want.paused) {
      if (state === YT_STATE.playing || state === YT_STATE.buffering) this.player.pauseVideo();
      if (drift > DRIFT_MS) this.player.seekTo(expected / 1000, true);
      return;
    }
    if (state === YT_STATE.paused || state === YT_STATE.cued || (this.hooks.loop && state === YT_STATE.ended)) this.player.playVideo();
    if (state === YT_STATE.playing && drift > DRIFT_MS) this.player.seekTo(expected / 1000, true);
    const stuck = state !== YT_STATE.playing && state !== YT_STATE.buffering && state !== YT_STATE.ended;
    this.hooks.onNeedsTap?.(stuck && now - this.loadedAt > BLOCKED_MS && want.volume > 0);
  }

  /** "Activar sonido": un toque de la persona deja al navegador reproducir con sonido. */
  tap() {
    this.player?.unMute();
    this.player?.playVideo();
    this.lastVolume = -1;
  }

  destroy() {
    this.player?.destroy();
    this.player = null;
    this.mount.destroy();
    active.delete(this);
    this.hooks.onNeedsTap?.(false);
  }

  private async create() {
    if (this.creating) return;
    this.creating = true;
    let YT: YTNamespace;
    try {
      YT = await loadApi();
    } catch {
      this.creating = false;
      return;
    }
    if (!this.mount.parent) return;
    const mount = this.mount.frame.firstElementChild as HTMLElement;
    this.player = new YT.Player(mount, {
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: () => {
          this.ready = true;
          this.lastSync = 0;
          if (this.want) this.update(this.want);
        },
        onStateChange: (e: { data: number }) => this.onState(e.data),
        onError: (e: { data: number }) => this.onError(e.data),
      },
    });
  }

  /**
   * ¿Es en vivo el video cargado? Lo dice el reproductor o, si no, su duración (enorme, o que crece). Al
   * saberlo, si quedó atrás del directo (arrancó en el segundo del servidor), salta una vez al directo: ahí
   * están todos.
   */
  private checkLive(state: number): boolean {
    if (this.live || !this.player || state !== YT_STATE.playing) return this.live;
    const d = this.player.getDuration();
    const data = this.player.getVideoData?.();
    if (data?.isLive || data?.isWindowedLive || d > MAX_VOD_S || (this.firstDuration > 0 && d - this.firstDuration > 1)) {
      this.live = true;
      if (d - this.player.getCurrentTime() > LIVE_BEHIND_S) this.player.seekTo(d, true);
    } else if (this.firstDuration <= 0 && d > 0) this.firstDuration = d;
    return this.live;
  }

  private onState(state: number) {
    const id = this.loaded;
    if (!id || !this.player) return;
    if (state === YT_STATE.playing) {
      this.hooks.onNeedsTap?.(false);
      const d = this.player.getDuration();
      // Un video en vivo no tiene duración: la que da es lo que lleva la transmisión.
      if (d > 0 && !this.reported.has(id) && !this.checkLive(state)) {
        this.reported.add(id);
        this.hooks.onDuration?.(id, Math.round(d * 1000));
      }
    }
    if (state === YT_STATE.ended) this.hooks.onEnded?.(id);
  }

  private onError(code: number) {
    if (this.loaded) this.hooks.onError?.(this.loaded, code);
  }
}
