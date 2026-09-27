// Un reproductor de YouTube (el iframe oficial, sin clave) encima del canvas: el del club, montado sobre
// la pantalla de la pared, y el de la radio de las oficinas, que solo suena. No se mueve nunca de lugar
// en el DOM (moverlo lo recargaría): se estira con una matriz CSS para que caiga sobre la pared inclinada
// y, en grande, se centra. Va al segundo que le digan (la hora del servidor): todos ven lo mismo.

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

export interface Point {
  x: number;
  y: number;
}

/** Dónde cae la imagen de la pantalla, en px del contenedor del juego (tres esquinas del recuadro). */
export interface ScreenQuad {
  tl: Point;
  tr: Point;
  bl: Point;
  /** Proporción ancho/alto del recuadro en la pared (sin la inclinación). */
  aspect: number;
}

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
}

/** Los reproductores vivos (el HUD los despierta con un toque sin cargar la escena). */
const active = new Set<YoutubeScreen>();
export const tapVideos = () => active.forEach((v) => v.tap());

/** Ancho base del recuadro (px antes de la matriz): de ahí salen el tamaño del iframe y la calidad. */
const BASE_W = 640;
/** Cada cuánto se revisa que el video vaya al segundo del servidor. */
const SYNC_MS = 700;
/** Desfase que se tolera antes de saltar al segundo correcto. */
const DRIFT_MS = 2000;
/** Si en este tiempo el video no arrancó solo, el navegador lo bloqueó: se pide un toque. */
const BLOCKED_MS = 3500;

export class YoutubeScreen {
  private host: HTMLDivElement;
  private frame: HTMLDivElement;
  private player: YTPlayer | null = null;
  private creating = false;
  private ready = false;
  /** La entrada que tiene cargada el reproductor. */
  private loaded: string | null = null;
  private loadedAt = 0;
  private reported = new Set<string>();
  private lastSync = 0;
  private lastVolume = -1;
  private layout = "";
  private want: VideoWant | null = null;

  constructor(
    parent: HTMLElement,
    private readonly hooks: ScreenHooks = {},
  ) {
    this.host = document.createElement("div");
    Object.assign(this.host.style, {
      position: "absolute",
      left: "0",
      top: "0",
      transformOrigin: "0 0",
      background: "#05030a",
      overflow: "hidden",
      visibility: "hidden",
      cursor: "zoom-in",
      zIndex: "1",
    } satisfies Partial<CSSStyleDeclaration>);
    this.host.title = hooks.titles?.small ?? "";
    this.host.addEventListener("click", () => hooks.onClick?.());
    this.frame = document.createElement("div");
    // El iframe no recibe clics: los toma la pantalla (para agrandar), no los controles de YouTube.
    Object.assign(this.frame.style, { position: "absolute", pointerEvents: "none" } satisfies Partial<CSSStyleDeclaration>);
    const mount = document.createElement("div");
    this.frame.appendChild(mount);
    this.host.appendChild(this.frame);
    parent.appendChild(this.host);
    active.add(this);
  }

  /** Cada frame: dónde se ve, cuánto suena y qué video y segundo tocan. */
  update(want: VideoWant) {
    this.want = want;
    this.place(want);
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
    if (this.lastVolume !== want.volume) {
      this.lastVolume = want.volume;
      if (want.volume <= 0) this.player.mute();
      else {
        this.player.unMute();
        this.player.setVolume(Math.round(want.volume * 100));
      }
    }
    const now = performance.now();
    if (now - this.lastSync < SYNC_MS && this.loaded === want.entry.id) return;
    this.lastSync = now;
    const expected = want.elapsedMs;
    if (this.loaded !== want.entry.id) {
      this.loaded = want.entry.id;
      this.loadedAt = now;
      this.player.loadVideoById({ videoId: want.entry.videoId, startSeconds: Math.max(0, expected / 1000) });
      if (want.paused) this.player.pauseVideo();
      return;
    }
    const state = this.player.getPlayerState();
    const drift = Math.abs(this.player.getCurrentTime() * 1000 - expected);
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
    this.host.remove();
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
    if (!this.host.isConnected) return;
    const mount = this.frame.firstElementChild as HTMLElement;
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

  private onState(state: number) {
    const id = this.loaded;
    if (!id || !this.player) return;
    if (state === YT_STATE.playing) {
      this.hooks.onNeedsTap?.(false);
      const d = this.player.getDuration();
      if (d > 0 && !this.reported.has(id)) {
        this.reported.add(id);
        this.hooks.onDuration?.(id, Math.round(d * 1000));
      }
    }
    if (state === YT_STATE.ended) this.hooks.onEnded?.(id);
  }

  private onError(code: number) {
    if (this.loaded) this.hooks.onError?.(this.loaded, code);
  }

  /** Estira el recuadro sobre la pantalla de la pared, o lo centra en grande. */
  private place(want: VideoWant) {
    const show = Boolean(want.entry) && (want.big || want.quad !== null);
    const parent = this.host.parentElement;
    let layout = "hidden";
    if (show && parent) {
      if (want.big) {
        const w = Math.min(parent.clientWidth * 0.8, (parent.clientHeight * 0.75 * 16) / 9);
        const h = (w * 9) / 16;
        layout = `big:${Math.round(w)}x${Math.round(h)}:${Math.round((parent.clientWidth - w) / 2)},${Math.round((parent.clientHeight - h) / 2)}`;
      } else {
        const q = want.quad!;
        const bh = BASE_W / q.aspect;
        const a = (q.tr.x - q.tl.x) / BASE_W;
        const b = (q.tr.y - q.tl.y) / BASE_W;
        const c = (q.bl.x - q.tl.x) / bh;
        const d = (q.bl.y - q.tl.y) / bh;
        layout = `wall:${bh.toFixed(1)}:${[a, b, c, d, q.tl.x, q.tl.y].map((n) => n.toFixed(3)).join(",")}`;
      }
    }
    if (layout === this.layout) return;
    this.layout = layout;
    const st = this.host.style;
    if (layout === "hidden") {
      st.visibility = "hidden";
      return;
    }
    st.visibility = "visible";
    let w: number;
    let h: number;
    if (layout.startsWith("big:")) {
      const [size, pos] = layout.slice(4).split(":");
      [w, h] = size!.split("x").map(Number) as [number, number];
      const [x, y] = pos!.split(",").map(Number) as [number, number];
      st.transform = `translate(${x}px, ${y}px)`;
      st.zIndex = "30";
      st.cursor = "zoom-out";
      st.boxShadow = "0 0 0 4px #1d1128, 0 0 0 7px #ff5fd2, 8px 8px 0 7px #1d1128";
      this.host.title = this.hooks.titles?.big ?? "";
    } else {
      const [bh, m] = layout.slice(5).split(":");
      w = BASE_W;
      h = Number(bh);
      st.transform = `matrix(${m})`;
      st.zIndex = "1";
      st.cursor = "zoom-in";
      st.boxShadow = "none";
      this.host.title = this.hooks.titles?.small ?? "";
    }
    st.width = `${w}px`;
    st.height = `${h}px`;
    // El video (16:9) va centrado dentro del recuadro, con bandas negras si no calza.
    const fw = Math.min(w, (h * 16) / 9);
    const fh = (fw * 9) / 16;
    Object.assign(this.frame.style, { width: `${fw}px`, height: `${fh}px`, left: `${(w - fw) / 2}px`, top: `${(h - fh) / 2}px` });
  }
}
