"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { audioCapture, chimeWav, type DeviceKind, levelFromSamples, mediaErrorMessage } from "@/game/devicePrefs";
import {
  canPickOutput,
  chooseDevice,
  type DeviceLists,
  listDevices,
  onDeviceChange,
  setAudioProcessing,
  useDeviceStore,
} from "@/game/devices";
import { useMediaStore } from "@/game/media";
import { OfficeDialog } from "./OfficeDialog";
import { PixelIcon } from "./Cozy";

const EMPTY: DeviceLists = { audioinput: [], videoinput: [], audiooutput: [] };

/**
 * Panel "Audio y video" (engranaje de la barra): elegir y probar micrófono, cámara y parlantes, y las
 * ayudas de audio. La prueba es local (su propio getUserMedia), así funciona sin LiveKit conectado.
 */
export function DevicePanel({ onClose }: { onClose: () => void }) {
  const prefs = useDeviceStore((s) => s.prefs);
  const status = useMediaStore((s) => s.status);
  const micLive = useMediaStore((s) => s.mic);
  const [devices, setDevices] = useState<DeviceLists>(EMPTY);
  const refresh = useCallback(() => void listDevices().then(setDevices), []);

  useEffect(() => {
    refresh();
    return onDeviceChange(refresh);
  }, [refresh]);

  const inCall = status === "connected";
  // Se abre desde la barra, cuyo transform encerraría la ventana en ella: va al <body> (con la letra de la cabaña).
  return createPortal(
    <div className="font-pixel text-cozy-ink">
      <OfficeDialog
        title="Audio y video"
        onClose={onClose}
        className="max-w-xl"
        footer={
          <>
            <p className="mr-auto text-[12px] text-cozy-ink-soft">
              {inCall && micLive ? "Los cambios se aplican al instante en la llamada." : "Se guarda en este navegador y se usa al prender el mic o la cámara."}
            </p>
            <button type="button" onClick={onClose} className="cozy-btn cozy-btn-primary px-4 py-1.5 text-[14px]">
              Listo
            </button>
          </>
        }
      >
        <div className="cozy-scroll flex min-h-0 flex-col gap-5 overflow-y-auto px-4 py-4 text-[14px]">
          <MicSection devices={devices.audioinput} onGranted={refresh} />
          <CamSection devices={devices.videoinput} onGranted={refresh} />
          <OutputSection devices={devices.audiooutput} deviceId={prefs.audiooutput} />
        </div>
      </OfficeDialog>
    </div>,
    document.body,
  );
}

function Section({ icon, title, children }: { icon: "mic" | "cam" | "sound"; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <PixelIcon name={icon} size={16} />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Nombre legible: sin permiso el navegador no da nombres. */
function label(d: MediaDeviceInfo, i: number, what: string) {
  return d.label || `${what} ${i + 1}`;
}

function DeviceSelect({
  kind,
  devices,
  value,
  what,
}: {
  kind: DeviceKind;
  devices: MediaDeviceInfo[];
  value: string;
  what: string;
}) {
  // Chrome agrega "default"/"communications": la opción "" ya es la del sistema (y se nombra con ella).
  const system = devices.find((d) => d.deviceId === "default");
  const list = devices.filter((d) => d.deviceId !== "default" && d.deviceId !== "communications");
  const known = value === "" || list.some((d) => d.deviceId === value);
  return (
    <select
      aria-label={what}
      value={value}
      onChange={(e) => void chooseDevice(kind, e.target.value)}
      className="cozy-input w-full px-2.5 py-2 text-[14px] font-normal"
    >
      <option value="">{system?.label ? system.label : "Predeterminado del sistema"}</option>
      {list.map((d, i) => (
        <option key={d.deviceId} value={d.deviceId}>
          {label(d, i, what)}
        </option>
      ))}
      {!known && <option value={value}>{what} guardado (no conectado)</option>}
    </select>
  );
}

/** Micrófono: selector, medidor de nivel en vivo y las ayudas de audio. */
function MicSection({ devices, onGranted }: { devices: MediaDeviceInfo[]; onGranted: () => void }) {
  const prefs = useDeviceStore((s) => s.prefs);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [heard, setHeard] = useState(false);
  const cover = useRef<HTMLDivElement>(null);
  const { audioinput, noiseSuppression, echoCancellation, autoGainControl } = prefs;

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no deja usar el micrófono (¿la página no está en https?).");
      return;
    }
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let stopped = false;
    let level = 0;
    const constraints = audioCapture({ audioinput, videoinput: "", audiooutput: "", noiseSuppression, echoCancellation, autoGainControl });
    navigator.mediaDevices
      .getUserMedia({ audio: constraints })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        setError(null);
        onGranted(); // con permiso, los dispositivos ya traen nombre
        ctx = new AudioContext();
        void ctx.resume().catch(() => undefined); // por si nace suspendido (política de autoplay)
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(s).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          // Sube rápido y baja suave, como un vúmetro.
          level = Math.max(levelFromSamples(data), level * 0.88);
          if (cover.current) cover.current.style.width = `${100 - Math.round(level * 100)}%`;
          if (level > 0.35) setHeard(true);
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((err) => {
        if (!stopped) setError(mediaErrorMessage(err, "micrófono"));
      });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => undefined);
      if (cover.current) cover.current.style.width = "100%";
    };
  }, [audioinput, noiseSuppression, echoCancellation, autoGainControl, retry, onGranted]);

  return (
    <Section icon="mic" title="Micrófono">
      <DeviceSelect kind="audioinput" devices={devices} value={audioinput} what="Micrófono" />
      {error ? (
        <ErrorBox message={error} onRetry={() => setRetry((n) => n + 1)} />
      ) : (
        <div className="flex flex-col gap-1">
          <div
            role="meter"
            aria-label="Nivel del micrófono"
            className="relative h-5 overflow-hidden border-2 border-cozy-frame bg-[linear-gradient(90deg,var(--color-cozy-green)_0%,var(--color-cozy-green-light)_55%,var(--color-cozy-gold)_78%,var(--color-cozy-red)_100%)]"
          >
            {/* Tapa lo que no llega: así cada tramo conserva su color (verde, amarillo, rojo). */}
            <div ref={cover} className="absolute inset-y-0 right-0 w-full bg-cozy-paper-dark" />
            {/* Rayas: el medidor se ve por segmentos, como en pixel art. */}
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_10px,var(--color-cozy-paper-dark)_10px_12px)]" />
          </div>
          <p className="text-[12px] text-cozy-ink-soft">
            {heard ? "¡Te oímos! Si la barra casi no se mueve al hablar normal, sube el volumen del micrófono." : "Habla un poco: la barra debería moverse."}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5 pt-1">
        <Check
          checked={noiseSuppression}
          onChange={(v) => void setAudioProcessing({ noiseSuppression: v })}
          text="Supresión de ruido"
          hint="Quita el teclado, el ventilador y el ruido de fondo."
        />
        <Check
          checked={echoCancellation}
          onChange={(v) => void setAudioProcessing({ echoCancellation: v })}
          text="Cancelación de eco"
          hint="Evita que los demás se oigan a sí mismos por tus parlantes."
        />
        <Check
          checked={autoGainControl}
          onChange={(v) => void setAudioProcessing({ autoGainControl: v })}
          text="Control automático de ganancia"
          hint="Empareja el volumen si te alejas o te acercas al micrófono."
        />
      </div>
    </Section>
  );
}

function Check({ checked, onChange, text, hint }: { checked: boolean; onChange: (v: boolean) => void; text: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-cozy-green)]"
      />
      <span>
        {text}
        <span className="block text-[12px] text-cozy-ink-soft">{hint}</span>
      </span>
    </label>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 border-2 border-cozy-red-deep bg-cozy-paper-light px-3 py-2 text-[13px]">
      <p className="flex-1">{message}</p>
      <button type="button" onClick={onRetry} className="cozy-btn shrink-0 px-2.5 py-1 text-[12px]">
        Reintentar
      </button>
    </div>
  );
}

/** Cámara: selector y vista previa (en espejo, como la ves en la llamada). */
function CamSection({ devices, onGranted }: { devices: MediaDeviceInfo[]; onGranted: () => void }) {
  const videoinput = useDeviceStore((s) => s.prefs.videoinput);
  const [on, setOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!on) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no deja usar la cámara (¿la página no está en https?).");
      return;
    }
    let got: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: videoinput ? { deviceId: videoinput } : true })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        got = s;
        setError(null);
        setStream(s); // el <video> puede no existir todavía (venía del error): se engancha al montarse
        onGranted();
      })
      .catch((err) => {
        if (!stopped) setError(mediaErrorMessage(err, "cámara"));
      });
    return () => {
      stopped = true;
      got?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [videoinput, on, retry, onGranted]);

  return (
    <Section icon="cam" title="Cámara">
      <DeviceSelect kind="videoinput" devices={devices} value={videoinput} what="Cámara" />
      {error ? (
        <ErrorBox message={error} onRetry={() => setRetry((n) => n + 1)} />
      ) : (
        <div className="relative aspect-video w-full overflow-hidden border-2 border-cozy-frame bg-cozy-void">
          {on ? (
            <video
              ref={(el) => {
                if (el && el.srcObject !== stream) el.srcObject = stream;
              }}
              autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          ) : (
            <p className="grid h-full place-items-center text-[13px] text-cozy-paper">Vista previa apagada</p>
          )}
          <button
            type="button"
            onClick={() => setOn((v) => !v)}
            className="cozy-btn absolute right-2 bottom-2 px-2.5 py-1 text-[12px]"
          >
            {on ? "Apagar vista previa" : "Ver cámara"}
          </button>
        </div>
      )}
    </Section>
  );
}

/** Parlantes: salida (donde el navegador deja elegirla) y un sonido de prueba por esa salida. */
function OutputSection({ devices, deviceId }: { devices: MediaDeviceInfo[]; deviceId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const pick = canPickOutput();

  const test = async () => {
    setMsg(null);
    setPlaying(true);
    const url = URL.createObjectURL(new Blob([chimeWav()], { type: "audio/wav" }));
    const audio = new Audio(url);
    const done = () => {
      URL.revokeObjectURL(url);
      setPlaying(false);
    };
    audio.onended = done;
    try {
      const sink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (pick && deviceId && sink.setSinkId) await sink.setSinkId(deviceId);
      await audio.play();
      setMsg("¿Sonó un tilín? Si no, revisa el volumen o elige otra salida.");
    } catch {
      done();
      setMsg("No se pudo reproducir el sonido por esa salida.");
    }
  };

  return (
    <Section icon="sound" title="Parlantes">
      {pick ? (
        <DeviceSelect kind="audiooutput" devices={devices} value={deviceId} what="Salida" />
      ) : (
        <p className="text-[12px] text-cozy-ink-soft">Este navegador usa la salida de audio del sistema.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void test()} disabled={playing} className="cozy-btn px-3 py-1.5 text-[13px]">
          <PixelIcon name="sound" size={14} />
          Probar parlantes
        </button>
        {msg && <p className="text-[12px] text-cozy-ink-soft">{msg}</p>}
      </div>
    </Section>
  );
}
