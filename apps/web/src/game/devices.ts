import { type LocalAudioTrack, type Room, RoomEvent, Track } from "livekit-client";
import { create } from "zustand";
import { audioCapture, type DeviceKind, type DevicePrefs, parsePrefs, PREFS_KEY } from "./devicePrefs";

/**
 * Micrófono, cámara y parlantes elegidos (panel "Audio y video"), y las ayudas de audio (supresión de
 * ruido, cancelación de eco, ganancia automática). Se recuerdan en este navegador y se aplican a la
 * sala de LiveKit: `media.ts` solo llama a `bindRoom` al armar cada sala; el resto vive acá.
 */

function loadPrefs(): DevicePrefs {
  try {
    return parsePrefs(typeof localStorage === "undefined" ? null : localStorage.getItem(PREFS_KEY));
  } catch {
    return parsePrefs(null); // almacenamiento bloqueado (incógnito estricto, iframe…)
  }
}

function savePrefs(prefs: DevicePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // sin almacenamiento: vale para esta sesión
  }
}

export const useDeviceStore = create<{ prefs: DevicePrefs }>(() => ({ prefs: loadPrefs() }));

const prefs = () => useDeviceStore.getState().prefs;

/** Se puede elegir la salida de audio (Chrome/Edge sí; Firefox y Safari según versión). */
export function canPickOutput(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

/** Sala de LiveKit actual (la arma `media.ts`; puede no haber ninguna). */
let current: Room | null = null;

/**
 * Deja la sala lista con lo elegido: las opciones de captura quedan como predeterminadas (así
 * `setMicrophoneEnabled` publica con ellas) y al conectar se cambia a los dispositivos guardados.
 * LiveKit mismo guarda el deviceId activo en `room.options`, así que ajustarlas acá es lo previsto.
 */
export function bindRoom(room: Room) {
  current = room;
  const p = prefs();
  room.options.audioCaptureDefaults = { ...room.options.audioCaptureDefaults, ...audioCapture(p) };
  if (p.videoinput) room.options.videoCaptureDefaults = { ...room.options.videoCaptureDefaults, deviceId: p.videoinput };
  if (p.audiooutput && canPickOutput()) room.options.audioOutput = { deviceId: p.audiooutput };
  room
    .on(RoomEvent.Connected, () => {
      if (current !== room) return;
      // exact = false: si el dispositivo guardado ya no está, LiveKit usa otro en vez de fallar.
      for (const kind of ["audioinput", "videoinput", "audiooutput"] as const) {
        const id = prefs()[kind];
        if (!id || (kind === "audiooutput" && !canPickOutput())) continue;
        room.switchActiveDevice(kind, id, false).catch(() => undefined);
      }
    })
    .on(RoomEvent.Disconnected, () => {
      if (current === room) current = null;
    });
}

/** Cambia un dispositivo: lo guarda y, si hay sala, lo cambia en vivo (también en lo ya publicado). */
export async function chooseDevice(kind: DeviceKind, deviceId: string): Promise<void> {
  const next = { ...prefs(), [kind]: deviceId };
  useDeviceStore.setState({ prefs: next });
  savePrefs(next);
  const room = current;
  if (!room) return;
  // "" = el del sistema: en Chrome es "default"; si no, el primero de la lista (así lo ordena el navegador).
  const id = deviceId || (await firstDeviceId(kind));
  if (!id) return;
  try {
    await room.switchActiveDevice(kind, id);
  } catch (err) {
    console.warn("No se pudo cambiar el dispositivo:", err);
  }
}

/** Cambia las ayudas de audio; si el micrófono está publicado, se reinicia con las nuevas. */
export async function setAudioProcessing(
  patch: Partial<Pick<DevicePrefs, "noiseSuppression" | "echoCancellation" | "autoGainControl">>,
): Promise<void> {
  const next = { ...prefs(), ...patch };
  useDeviceStore.setState({ prefs: next });
  savePrefs(next);
  const room = current;
  if (!room) return;
  const opts = audioCapture(next);
  room.options.audioCaptureDefaults = { ...room.options.audioCaptureDefaults, ...opts };
  const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
  if (track && !track.isMuted) {
    try {
      await track.restartTrack({ ...room.options.audioCaptureDefaults, ...opts });
    } catch (err) {
      console.warn("No se pudo reiniciar el micrófono:", err);
    }
  }
}

async function firstDeviceId(kind: DeviceKind): Promise<string | undefined> {
  const list = await listDevices();
  return list[kind][0]?.deviceId;
}

export type DeviceLists = Record<DeviceKind, MediaDeviceInfo[]>;

/** Dispositivos por tipo (sin permiso todavía, el navegador los da sin nombre). */
export async function listDevices(): Promise<DeviceLists> {
  const out: DeviceLists = { audioinput: [], videoinput: [], audiooutput: [] };
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return out;
  try {
    for (const d of await navigator.mediaDevices.enumerateDevices()) {
      if (d.deviceId && d.kind in out) out[d.kind].push(d);
    }
  } catch {
    // sin permiso o sin soporte: listas vacías
  }
  return out;
}

/** Avisa cuando se conecta o desconecta un dispositivo. Devuelve cómo dejar de escuchar. */
export function onDeviceChange(fn: () => void): () => void {
  const md = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!md?.addEventListener) return () => undefined;
  md.addEventListener("devicechange", fn);
  return () => md.removeEventListener("devicechange", fn);
}
