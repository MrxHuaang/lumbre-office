import {
  ConnectionState,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  type Participant,
} from "livekit-client";
import { create } from "zustand";
import { useOfficeStore } from "./store";

export type MediaStatus = "off" | "connecting" | "connected" | "unavailable";

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
  /** Participantes conectados a LiveKit (todos, se oigan o no). */
  participants: Record<string, MediaParticipant>;
  /** Identidades hablando ahora (incluida la local). */
  speaking: string[];
  /** Sube cuando cambian los tracks suscritos, para re-renderizar los videos. */
  trackVersion: number;
  /** Pantalla compartida ampliada (identidad). */
  focused: string | null;
  setHearing: (h: Record<string, number>) => void;
  setFocused: (identity: string | null) => void;
}

export const useMediaStore = create<MediaStore>((set) => ({
  status: "off",
  mic: false,
  cam: false,
  screen: false,
  hearing: {},
  participants: {},
  speaking: [],
  trackVersion: 0,
  focused: null,
  setHearing: (hearing) => {
    set({ hearing });
    media.applyHearing(hearing);
  },
  setFocused: (focused) => set({ focused }),
}));

const initialMedia = {
  status: "off" as MediaStatus,
  mic: false,
  cam: false,
  screen: false,
  participants: {},
  speaking: [],
  focused: null,
};

/**
 * Audio/video por proximidad sobre una sola sala de LiveKit:
 * - nos suscribimos solo a quienes podemos oír (`hearing`), con volumen según la distancia;
 * - y le decimos al SFU que SOLO esas personas pueden suscribirse a nuestros tracks
 *   (setTrackSubscriptionPermissions): la privacidad de oficinas/salas la aplica el servidor de video.
 */
class MediaManager {
  private room: Room | null = null;
  private generation = 0;
  private audioEls = new Map<string, HTMLMediaElement[]>(); // trackSid → elementos <audio>
  private lastAllowed = "";

  get connected() {
    return this.room?.state === ConnectionState.Connected;
  }

  async connect() {
    const gen = ++this.generation;
    useMediaStore.setState({ ...initialMedia, status: "connecting" });
    let creds: { token: string; url: string };
    try {
      const res = await fetch("/api/livekit/token", { cache: "no-store" });
      if (!res.ok) throw new Error(`token ${res.status}`);
      creds = await res.json();
    } catch {
      if (gen === this.generation) useMediaStore.setState({ status: "unavailable" });
      return;
    }
    if (gen !== this.generation) return;

    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.wire(room);
    try {
      await room.connect(creds.url, creds.token, { autoSubscribe: false });
    } catch (err) {
      console.warn("LiveKit no disponible:", err);
      if (gen === this.generation) useMediaStore.setState({ status: "unavailable" });
      return;
    }
    if (gen !== this.generation) {
      void room.disconnect();
      return;
    }
    this.room = room;
    this.lastAllowed = "";
    useMediaStore.setState({ status: "connected" });
    this.syncParticipants();
    this.applyHearing(useMediaStore.getState().hearing);
  }

  async disconnect() {
    this.generation++;
    const room = this.room;
    this.room = null;
    for (const els of this.audioEls.values()) els.forEach((el) => el.remove());
    this.audioEls.clear();
    useMediaStore.setState({ ...initialMedia });
    await room?.disconnect().catch(() => undefined);
  }

  async toggleMic() {
    await this.toggle("mic", (on) => this.room!.localParticipant.setMicrophoneEnabled(on));
  }
  async toggleCam() {
    await this.toggle("cam", (on) => this.room!.localParticipant.setCameraEnabled(on));
  }
  async toggleScreen() {
    await this.toggle("screen", (on) => this.room!.localParticipant.setScreenShareEnabled(on));
  }

  /** Aplica suscripciones, permisos y volúmenes según a quién oye el jugador local. */
  applyHearing(hearing: Record<string, number>) {
    const room = this.room;
    if (!room || !this.connected) return;

    const allowed = Object.keys(hearing).sort();
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

  private async toggle(kind: "mic" | "cam" | "screen", fn: (on: boolean) => Promise<unknown>) {
    if (!this.room || !this.connected) return;
    const next = !useMediaStore.getState()[kind];
    try {
      await fn(next);
      useMediaStore.setState({ [kind]: next } as Pick<MediaStore, typeof kind>);
    } catch (err) {
      const denied = err instanceof Error && /Permission|NotAllowed/i.test(err.name + err.message);
      if (kind === "screen" && denied) return; // el usuario canceló el selector de pantalla
      useOfficeStore
        .getState()
        .notify(
          denied
            ? `El navegador bloqueó ${kind === "mic" ? "el micrófono" : kind === "cam" ? "la cámara" : "la pantalla"}. Revisa los permisos del sitio.`
            : `No se pudo ${next ? "activar" : "desactivar"} ${kind === "mic" ? "el micrófono" : kind === "cam" ? "la cámara" : "la pantalla compartida"}.`,
          "warning",
        );
    }
    this.bump();
  }

  private wire(room: Room) {
    const sync = () => {
      if (this.room === room) this.syncParticipants();
    };
    room
      .on(RoomEvent.ParticipantConnected, (p) => {
        sync();
        this.applyTo(p, useMediaStore.getState().hearing);
      })
      .on(RoomEvent.ParticipantDisconnected, sync)
      .on(RoomEvent.TrackPublished, (_pub, p) => {
        sync();
        this.applyTo(p, useMediaStore.getState().hearing);
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
      .on(RoomEvent.Disconnected, () => {
        if (this.room !== room) return;
        this.room = null;
        useMediaStore.setState({ ...initialMedia, status: "unavailable" });
      });
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
