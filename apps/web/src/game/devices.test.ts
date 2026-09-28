import { RoomEvent, type Room } from "livekit-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "./devicePrefs";
import { bindRoom, chooseDevice, setAudioProcessing, useDeviceStore } from "./devices";

/** Sala de mentira: lo justo que usa devices.ts (opciones, eventos, cambio de dispositivo y el mic publicado). */
function fakeRoom(micTrack?: { isMuted: boolean; restartTrack: (o: unknown) => Promise<void> }) {
  const handlers = new Map<string, () => void>();
  const room = {
    options: { audioCaptureDefaults: { autoGainControl: true, channelCount: 1 }, videoCaptureDefaults: {} } as Record<string, unknown>,
    on(ev: string, fn: () => void) {
      handlers.set(ev, fn);
      return room;
    },
    switchActiveDevice: vi.fn(async () => true),
    localParticipant: { getTrackPublication: () => (micTrack ? { track: micTrack } : undefined) },
    emit: (ev: string) => handlers.get(ev)?.(),
  };
  return room;
}

describe("dispositivos en la sala de LiveKit", () => {
  beforeEach(() => useDeviceStore.setState({ prefs: { ...DEFAULT_PREFS } }));

  it("al armar la sala deja las ayudas de audio y el micrófono elegido como predeterminados", () => {
    useDeviceStore.setState({ prefs: { ...DEFAULT_PREFS, audioinput: "mic-usb", videoinput: "cam-2", noiseSuppression: false } });
    const room = fakeRoom();
    bindRoom(room as unknown as Room);
    expect(room.options.audioCaptureDefaults).toEqual({
      channelCount: 1, // lo que ya traía LiveKit se conserva
      deviceId: "mic-usb",
      noiseSuppression: false,
      voiceIsolation: false,
      echoCancellation: true,
      autoGainControl: true,
    });
    expect(room.options.videoCaptureDefaults).toEqual({ deviceId: "cam-2" });
  });

  it("al conectar cambia a los dispositivos guardados sin fallar si ya no están", () => {
    useDeviceStore.setState({ prefs: { ...DEFAULT_PREFS, audioinput: "mic-usb" } });
    const room = fakeRoom();
    bindRoom(room as unknown as Room);
    room.emit(RoomEvent.Connected);
    expect(room.switchActiveDevice).toHaveBeenCalledWith("audioinput", "mic-usb", false);
    expect(room.switchActiveDevice).toHaveBeenCalledTimes(1); // cámara y salida: las del sistema
  });

  it("elegir un dispositivo con la sala abierta lo cambia en vivo", async () => {
    const room = fakeRoom();
    bindRoom(room as unknown as Room);
    await chooseDevice("videoinput", "cam-1");
    expect(useDeviceStore.getState().prefs.videoinput).toBe("cam-1");
    expect(room.switchActiveDevice).toHaveBeenCalledWith("videoinput", "cam-1");
  });

  it("cambiar las ayudas de audio reinicia el micrófono publicado", async () => {
    const mic = { isMuted: false, restartTrack: vi.fn(async () => undefined) };
    const room = fakeRoom(mic);
    bindRoom(room as unknown as Room);
    await setAudioProcessing({ echoCancellation: false });
    expect(mic.restartTrack).toHaveBeenCalledWith(expect.objectContaining({ echoCancellation: false, noiseSuppression: true }));
    expect(room.options.audioCaptureDefaults).toMatchObject({ echoCancellation: false });
  });

  it("sin sala solo guarda la preferencia", async () => {
    const room = fakeRoom();
    bindRoom(room as unknown as Room);
    room.emit(RoomEvent.Disconnected);
    await chooseDevice("audioinput", "mic-lap");
    expect(useDeviceStore.getState().prefs.audioinput).toBe("mic-lap");
    expect(room.switchActiveDevice).not.toHaveBeenCalled();
  });
});
