import { nextVoiceLink, VOICE_LINK_IDLE, type VoiceLink } from "@hyvento/shared";
import {
  ConnectionState,
  createLocalScreenTracks,
  DisconnectReason,
  type LocalTrack,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  type Participant,
} from "livekit-client";
import { create } from "zustand";
import { tokenUsable } from "./livekitToken";
import { useOfficeStore } from "./store";
import { bindRoom } from "./devices";

/**
 * - off: fuera de la cabaña.
 * - idle: en espera; sin sala abierta porque no hay nadie cerca (se abre sola cuando haga falta).
 * - connecting / connected: la sala de LiveKit.
 * - unavailable: sin credenciales de LiveKit o falló la conexión (se reintenta más tarde).
 */
export type MediaStatus = "off" | "idle" | "connecting" | "connected" | "unavailable";

/** Vista ampliada: cámara o pantalla de alguien (identity = null → la propia). */
export interface Focus {
  identity: string | null;
  source: "camera" | "screen";
}

export interface MediaParticipant {
  identity: string;
  name: string;
  mic: boolean;
  cam: boolean;
  screen: boolean;
}

interface MediaStore {
  status: MediaStatus;
  mic: boolean;
  cam: boolean;
  screen: boolean;
  /** userId → volumen (0–1) de quienes el jugador local puede oír. Lo calcula la escena. */
  hearing: Record<string, number>;
  /**
   * Quienes me oyen aunque yo no los oiga (el público del escenario oye a la tarima): también pueden
   * suscribirse a mis pistas. Lo calcula la escena con `listeners` de @hyvento/shared.
   */
  listeners: string[];
  /** Participantes conectados a LiveKit (todos, se oigan o no). */
  participants: Record<string, MediaParticipant>;
  /** Identidades hablando ahora (incluida la local). */
  speaking: string[];
  /** Sube cuando cambian los tracks suscritos, para re-renderizar los videos. */
  trackVersion: number;
  focused: Focus | null;
  setHearing: (h: Record<string, number>, listeners?: string[]) => void;
  setFocused: (focus: Focus | null) => void;
}

export const useMediaStore = create<MediaStore>((set) => ({
  status: "off",
  mic: false,
  cam: false,
  screen: false,
  hearing: {},
  listeners: [],
  participants: {},
  speaking: [],
  trackVersion: 0,
  focused: null as Focus | null,
  setHearing: (hearing, listeners = []) => {
    set({ hearing, listeners });
    media.applyHearing(hearing, listeners);
  },
  setFocused: (focused) => set({ focused }),
}));

const initialMedia = {
  mic: false,
  cam: false,
  screen: false,
  participants: {},
  speaking: [],
  focused: null,
};

/** Cada cuánto se revisa si hace falta la sala (con la pestaña oculta el navegador lo espacia más). */
const LINK_CHECK_MS = 1000;
/** Espera antes de reintentar tras una conexión fallida: crece al repetirse (p. ej. sin cupo en LiveKit). */
const RETRY_MIN_MS = 15_000;
const RETRY_MAX_MS = 5 * 60_000;

type Creds = { token: string; url: string };

/** El servidor dijo que no hay audio/video (sin credenciales de LiveKit): no se reintenta en la sesión. */
class NotConfigured extends Error {}

/**
 * Audio/video por proximidad sobre una sola sala de LiveKit:
 * - nos suscribimos solo a quienes podemos oír (`hearing`), con volumen según la distancia;
 * - y le decimos al SFU que SOLO esas personas pueden suscribirse a nuestros tracks
 *   (setTrackSubscriptionPermissions): la privacidad de oficinas/salas la aplica el servidor de video.
 *
 * LiveKit cobra por minuto conectado, así que la sala se abre solo cuando hace falta (ver
 * `voice-link.ts` en shared): alguien cerca o en llamada (lo dice la escena con `setDemand`), o
 * mic/cámara/pantalla prendidos. Sin eso, tras `VOICE_IDLE_GRACE_MS` se desconecta y queda "idle".
 */
class MediaManager {
  private room: Room | null = null;
  private generation = 0;
  private audioEls = new Map<string, HTMLMediaElement[]>(); // trackSid → elementos <audio>
  private lastAllowed = "";
  /** En la cabaña (entre `start` y `stop`). */
  private active = false;
  private demand: (() => boolean) | null = null;
  private link: VoiceLink = VOICE_LINK_IDLE;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: Promise<Room | null> | null = null;
  private creds: Creds | null = null;
  /** Sin credenciales, o la sala se abrió en otra pestaña: no se reintenta hasta recargar. */
  private blocked = false;
  private retryAt = 0;
  private retryDelay = RETRY_MIN_MS;
  /** Toggles esperando la conexión: mientras tanto la sala hace falta. */
  private waiting = 0;

  get connected() {
    return this.room?.state === ConnectionState.Connected;
  }

  /** Al entrar a la cabaña: todavía no se conecta, solo empieza a revisar si hace falta. */
  start() {
    if (this.active) return;
    this.active = true;
    this.link = VOICE_LINK_IDLE;
    useMediaStore.setState({ ...initialMedia, status: this.blocked ? "unavailable" : "idle" });
    this.timer = setInterval(() => this.check(), LINK_CHECK_MS);
    this.check();
  }

  /** Al salir de la cabaña. */
  async stop() {
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.link = VOICE_LINK_IDLE;
    await this.release("off");
  }

  /** La escena dice si hay alguien cerca o en llamada (se consulta en cada revisión). */
  setDemand(fn: (() => boolean) | null) {
    this.demand = fn;
    if (fn) this.check();
  }

  private publishing() {
    const s = useMediaStore.getState();
    return s.mic || s.cam || s.screen || this.waiting > 0;
  }

  /** Decide si abrir o soltar la sala. */
  private check() {
    if (!this.active) return;
    const now = Date.now();
    let needed = this.publishing();
    try {
      needed ||= this.demand?.() ?? false;
    } catch {
      // La escena se está armando o desarmando: se revisa en la próxima vuelta.
    }
    this.link = nextVoiceLink(this.link, needed, now);
    if (this.link.linked) {
      if (!this.room && !this.pending && !this.blocked && now >= this.retryAt) void this.ensureRoom();
      return;
    }
    if (this.room || this.pending) void this.release("idle");
    // Tras un fallo y sin nadie cerca vuelve a "en espera" (reintenta cuando haga falta y pase la espera).
    else if (!this.blocked && useMediaStore.getState().status === "unavailable") useMediaStore.setState({ status: "idle" });
  }

  /** La sala conectada, conectándose si hace falta (una sola conexión a la vez). */
  private ensureRoom(): Promise<Room | null> {
    if (this.room) return Promise.resolve(this.room); // conectada (o LiveKit reconectándola por su cuenta)
    if (!this.active || this.blocked) return Promise.resolve(null);
    if (this.pending) return this.pending;
    const pending = this.open().finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }

  private async open(): Promise<Room | null> {
    const gen = ++this.generation;
    useMediaStore.setState({ status: "connecting", participants: {}, speaking: [] });
    const room = new Room({ adaptiveStream: true, dynacast: true });
    try {
      const creds = await this.credentials();
      if (gen !== this.generation) return null;
      this.wire(room);
      await room.connect(creds.url, creds.token, { autoSubscribe: false });
    } catch (err) {
      if (gen !== this.generation) return null;
      if (err instanceof NotConfigured) {
        this.blocked = true;
      } else {
        console.warn("LiveKit no disponible:", err);
        this.creds = null; // quizás el token ya no sirve: se pide otro en el próximo intento
        this.retryAt = Date.now() + this.retryDelay;
        this.retryDelay = Math.min(RETRY_MAX_MS, this.retryDelay * 2);
      }
      useMediaStore.setState({ status: "unavailable" });
      void room.disconnect();
      return null;
    }
    if (gen !== this.generation) {
      void room.disconnect();
      return null;
    }
    this.room = room;
    this.lastAllowed = "";
    this.retryDelay = RETRY_MIN_MS;
    useMediaStore.setState({ status: "connected" });
    this.syncParticipants();
    this.applyHearing(useMediaStore.getState().hearing, useMediaStore.getState().listeners);
    return room;
  }

  /** Token y URL de LiveKit; el token se reutiliza mientras no esté por vencer. */
  private async credentials(): Promise<Creds> {
    if (this.creds && tokenUsable(this.creds.token, Date.now())) return this.creds;
    const res = await fetch("/api/livekit/token", { cache: "no-store" });
    if (res.status === 503) throw new NotConfigured();
    if (!res.ok) throw new Error(`token ${res.status}`);
    this.creds = (await res.json()) as Creds;
    return this.creds;
  }

  /** Suelta la sala (sin nadie cerca, o al salir de la cabaña). */
  private async release(status: "idle" | "off") {
    this.generation++; // una conexión a medio abrir se descarta sola al terminar
    this.pending = null;
    const room = this.room;
    this.room = null;
    this.clearAudio();
    useMediaStore.setState((s) => ({
      ...initialMedia,
      status: status === "idle" && this.blocked ? "unavailable" : status,
      trackVersion: s.trackVersion + 1,
    }));
    await room?.disconnect().catch(() => undefined);
  }

  async toggleMic() {
    await this.toggle("mic", (room, on) => room.localParticipant.setMicrophoneEnabled(on));
  }
  async toggleCam() {
    await this.toggle("cam", (room, on) => room.localParticipant.setCameraEnabled(on));
  }
  async toggleScreen() {
    await this.toggle("screen", async (room, on, captured) => {
      if (!captured) return room.localParticipant.setScreenShareEnabled(on);
      for (const track of captured) await room.localParticipant.publishTrack(track);
    });
  }

  /** Aplica suscripciones, permisos y volúmenes según a quién oye el jugador local. */
  applyHearing(hearing: Record<string, number>, listeners: string[] = []) {
    const room = this.room;
    if (!room || !this.connected) return;

    const allowed = [...new Set([...Object.keys(hearing), ...listeners])].sort();
    const key = allowed.join(",");
    if (key !== this.lastAllowed) {
      this.lastAllowed = key;
      room.localParticipant.setTrackSubscriptionPermissions(
        false,
        allowed.map((participantIdentity) => ({ participantIdentity, allowAll: true })),
      );
    }

    for (const p of room.remoteParticipants.values()) this.applyTo(p, hearing);
  }

  /** Track de video de un participante (o del local con identity = null). */
  videoTrack(identity: string | null, source: Track.Source.Camera | Track.Source.ScreenShare): Track | undefined {
    const room = this.room;
    if (!room) return undefined;
    const participant: Participant | undefined =
      identity === null ? room.localParticipant : room.remoteParticipants.get(identity);
    const pub = participant?.getTrackPublication(source);
    return pub && !pub.isMuted ? pub.track : undefined;
  }

  /**
   * La pista de audio del micrófono de alguien (o la mía con identity = null), para grabarla en la cabina
   * de grabación. Solo están las de quienes oigo (a los demás no estoy suscrito).
   */
  audioTrack(identity: string | null): MediaStreamTrack | undefined {
    const room = this.room;
    if (!room) return undefined;
    const participant: Participant | undefined = identity === null ? room.localParticipant : room.remoteParticipants.get(identity);
    const pub = participant?.getTrackPublication(Track.Source.Microphone);
    return pub && !pub.isMuted ? pub.track?.mediaStreamTrack : undefined;
  }

  get localIdentity() {
    return this.room?.localParticipant.identity ?? null;
  }

  private applyTo(p: RemoteParticipant, hearing: Record<string, number>) {
    const volume = hearing[p.identity];
    const hear = volume !== undefined;
    for (const pub of p.trackPublications.values()) {
      if (pub.isSubscribed !== hear) pub.setSubscribed(hear);
    }
    if (hear) {
      p.setVolume(volume, Track.Source.Microphone);
      p.setVolume(volume, Track.Source.ScreenShareAudio);
    }
  }

  /**
   * Prende o apaga mic/cámara/pantalla. Prender sin sala la abre primero. La pantalla se captura antes
   * de conectar: el navegador solo deja elegirla mientras dura el clic.
   */
  private async toggle(
    kind: "mic" | "cam" | "screen",
    fn: (room: Room, on: boolean, captured?: LocalTrack[]) => Promise<unknown>,
  ) {
    if (!this.active) return;
    const next = !useMediaStore.getState()[kind];
    const what = kind === "mic" ? "el micrófono" : kind === "cam" ? "la cámara" : "la pantalla";
    let captured: LocalTrack[] | undefined;
    this.waiting++;
    try {
      if (next && kind === "screen" && !this.room) captured = await createLocalScreenTracks();
      const room = next ? await this.ensureRoom() : this.room;
      if (!room) {
        if (next) useOfficeStore.getState().notify(`No se pudo conectar el audio y video para prender ${what}.`, "warning");
        return;
      }
      await fn(room, next, captured);
      captured = undefined;
      useMediaStore.setState({ [kind]: next } as Pick<MediaStore, typeof kind>);
    } catch (err) {
      const denied = err instanceof Error && /Permission|NotAllowed/i.test(err.name + err.message);
      if (kind === "screen" && denied) return; // el usuario canceló el selector de pantalla
      useOfficeStore
        .getState()
        .notify(
          denied
            ? `El navegador bloqueó ${what}. Revisa los permisos del sitio.`
            : `No se pudo ${next ? "activar" : "desactivar"} ${kind === "screen" ? "la pantalla compartida" : what}.`,
          "warning",
        );
    } finally {
      this.waiting--;
      captured?.forEach((t) => t.stop()); // capturada pero sin publicar
      this.bump();
    }
  }

  private wire(room: Room) {
    bindRoom(room); // micrófono, cámara, parlantes y ayudas de audio elegidos (devices.ts)
    const sync = () => {
      if (this.room === room) this.syncParticipants();
    };
    room
      .on(RoomEvent.ParticipantConnected, (p) => {
        sync();
        this.applyTo(p, useMediaStore.getState().hearing);
      })
      .on(RoomEvent.ParticipantDisconnected, sync)
      .on(RoomEvent.TrackPublished, (pub, p) => {
        sync();
        this.applyTo(p, useMediaStore.getState().hearing);
        // Avisar a quienes lo oyen que empezó a compartir pantalla.
        if (pub.source === Track.Source.ScreenShare && useMediaStore.getState().hearing[p.identity] !== undefined) {
          const identity = p.identity;
          useOfficeStore.getState().notify(`${p.name || "Alguien"} está compartiendo su pantalla`, "info", {
            label: "Ver",
            run: () => useMediaStore.getState().setFocused({ identity, source: "screen" }),
          });
        }
      })
      .on(RoomEvent.TrackUnpublished, sync)
      .on(RoomEvent.TrackMuted, sync)
      .on(RoomEvent.TrackUnmuted, sync)
      .on(RoomEvent.TrackSubscribed, (track) => {
        this.attachAudio(track);
        this.bump();
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        this.detachAudio(track);
        this.bump();
      })
      .on(RoomEvent.LocalTrackPublished, () => this.bump())
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        // p. ej. el usuario detuvo la pantalla compartida desde el botón del navegador
        if (pub.source === Track.Source.ScreenShare) useMediaStore.setState({ screen: false });
        this.bump();
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (this.room === room) useMediaStore.setState({ speaking: speakers.map((s) => s.identity) });
      })
      .on(RoomEvent.Disconnected, (reason) => {
        // Se cayó sin que la soltáramos (LiveKit ya agotó sus reintentos): se vuelve a probar más tarde.
        // Si entró la misma persona desde otra pestaña, esta se queda sin video: reintentar la echaría
        // a ella, y así en bucle.
        if (this.room !== room) return;
        this.room = null;
        this.clearAudio();
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) this.blocked = true;
        this.retryAt = Date.now() + this.retryDelay;
        useMediaStore.setState((s) => ({ ...initialMedia, status: "unavailable", trackVersion: s.trackVersion + 1 }));
      });
  }

  private clearAudio() {
    for (const els of this.audioEls.values()) els.forEach((el) => el.remove());
    this.audioEls.clear();
  }

  private attachAudio(track: RemoteTrack) {
    if (track.kind !== Track.Kind.Audio || !track.sid) return;
    const el = track.attach();
    el.style.display = "none";
    document.body.appendChild(el);
    this.audioEls.set(track.sid, [...(this.audioEls.get(track.sid) ?? []), el]);
  }

  private detachAudio(track: RemoteTrack) {
    if (track.kind !== Track.Kind.Audio || !track.sid) return;
    track.detach().forEach((el) => el.remove());
    this.audioEls.delete(track.sid);
  }

  private syncParticipants() {
    const room = this.room;
    if (!room) return;
    const participants: Record<string, MediaParticipant> = {};
    for (const p of room.remoteParticipants.values()) {
      participants[p.identity] = {
        identity: p.identity,
        name: p.name || p.identity,
        mic: p.isMicrophoneEnabled,
        cam: p.isCameraEnabled,
        screen: p.isScreenShareEnabled,
      };
    }
    useMediaStore.setState({ participants });
    this.bump();
  }

  private bump() {
    useMediaStore.setState((s) => ({ trackVersion: s.trackVersion + 1 }));
  }
}

export const media = new MediaManager();
