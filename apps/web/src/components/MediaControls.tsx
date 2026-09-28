"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { media, useMediaStore } from "@/game/media";
import { NAME_TAG_LABEL, selectFocusing, useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "./Cozy";
import { DevicePanel } from "./DevicePanel";
import { EmotePicker, useEmoteKey } from "./EmotePicker";
import { takePhoto, usePhotoCounting, usePhotoKey } from "./PhotoPanels";

/**
 * La barra de abajo al centro (estilo Stardew): arriba los botones (micrófono, cámara, pantalla, chat,
 * emotes, foto, nombres) y lo que se hace con lo de la mano (`actions`); abajo la fila de la mochila
 * (`children`). En pantallas anchas va todo en una línea. Publica su alto en `--cozy-bar-top` (en el
 * <main>) para que el chat, los avisos y las tiras de las mesas se paren justo encima.
 */
export function MediaControls({ children, actions }: { children?: ReactNode; actions?: ReactNode } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const publish = () => host.style.setProperty("--cozy-bar-top", `${Math.ceil(host.getBoundingClientRect().bottom - el.getBoundingClientRect().top) + 12}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    ro.observe(host);
    return () => {
      ro.disconnect();
      host.style.removeProperty("--cozy-bar-top");
    };
  }, []);
  const status = useMediaStore((s) => s.status);
  const mic = useMediaStore((s) => s.mic);
  const cam = useMediaStore((s) => s.cam);
  const screen = useMediaStore((s) => s.screen);
  const chatOpen = useOfficeStore((s) => s.chatOpen);
  const unread = useOfficeStore((s) => s.unread);
  // En modo foco el contador no se muestra (los mensajes se ven al terminar el bloque).
  const focusing = useOfficeStore(selectFocusing);
  const setChatOpen = useOfficeStore((s) => s.setChatOpen);
  // En espera (sin nadie cerca) también se puede prender: la sala de video se abre al hacerlo.
  const ready = status === "connected" || status === "idle" || status === "connecting";
  // Sin conexión de audio/video, los tres primeros botones dicen por qué (antes era un chip arriba).
  const mediaDown = status === "unavailable" ? "Audio y video no disponibles" : status === "connecting" ? "Conectando audio y video…" : null;
  const [emotes, setEmotes] = useState(false);
  useEmoteKey(useCallback(() => setEmotes((v) => !v), []));
  usePhotoKey();
  const shooting = usePhotoCounting();
  const nameTags = useOfficeStore((s) => s.nameTags);
  const cycleNameTags = useOfficeStore((s) => s.cycleNameTags);
  useNameTagKey();
  const [devicesOpen, setDevicesOpen] = useState(false);
  const closeDevices = useCallback(() => setDevicesOpen(false), []);

  return (
    <div
      ref={ref}
      className="cozy-panel absolute bottom-3 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col items-center gap-2 p-2 2xl:flex-row 2xl:gap-3 max-sm:bottom-2 max-sm:p-1.5"
    >
      {emotes && <EmotePicker onClose={() => setEmotes(false)} />}
      {devicesOpen && <DevicePanel onClose={closeDevices} />}
      <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 max-sm:gap-1">
        <Slot
          icon="mic"
          off={!mic}
          label={mediaDown ?? (mic ? "Silenciar micrófono" : "Activar micrófono")}
          text={mic ? "Mic" : "Mic off"}
          active={mic}
          disabled={!ready}
          onClick={() => void media.toggleMic()}
        />
        <Slot
          icon="cam"
          off={!cam}
          label={mediaDown ?? (cam ? "Apagar cámara" : "Encender cámara")}
          text={cam ? "Cámara" : "Cam off"}
          active={cam}
          disabled={!ready}
          onClick={() => void media.toggleCam()}
        />
        {/* Audio y video: funciona sin LiveKit (la prueba es local), por eso nunca se deshabilita. */}
        <button
          type="button"
          onClick={() => setDevicesOpen(true)}
          aria-label="Audio y video: elegir y probar micrófono, cámara y parlantes"
          aria-haspopup="dialog"
          title="Audio y video"
          className="cozy-btn h-[58px] w-7 p-0 max-sm:h-12 max-sm:w-6"
        >
          <PixelIcon name="gear" size={14} />
        </button>
        <Slot
          icon="screen"
          label={mediaDown ?? (screen ? "Dejar de compartir" : "Compartir pantalla")}
          text={screen ? "Compartiendo" : "Pantalla"}
          active={screen}
          disabled={!ready}
          onClick={() => void media.toggleScreen()}
        />
        <Slot
          icon="chat"
          label={chatOpen ? "Cerrar chat" : "Abrir chat (Enter)"}
          text="Chat"
          active={chatOpen}
          disabled={false}
          onClick={() => setChatOpen(!chatOpen)}
          badge={!chatOpen && !focusing && unread > 0 ? unread : undefined}
        />
        <Slot icon="smile" label="Emotes (T)" text="Emotes" active={emotes} disabled={false} onClick={() => setEmotes((v) => !v)} />
        <Slot
          icon="camera"
          label="Sacar una foto (P)"
          text={shooting.counting ? "3, 2, 1…" : "Foto"}
          active={shooting.counting}
          disabled={shooting.busy}
          onClick={takePhoto}
        />
        <Slot
          icon="tag"
          off={nameTags === "oculto"}
          label={`${NAME_TAG_LABEL[nameTags]} (N para cambiar; al pasar el mouse se ve el nombre completo)`}
          text={nameTags === "completo" ? "Nombres" : nameTags === "corto" ? "Cortos" : "Ocultos"}
          active={nameTags !== "corto"}
          disabled={false}
          onClick={cycleNameTags}
        />
        {actions}
      </div>
      {children}
    </div>
  );
}

/** N cambia cómo se ven los nombres (completos, cortos, ocultos), salvo escribiendo o con el PC prendido. */
function useNameTagKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const s = useOfficeStore.getState();
      const t = e.target as HTMLElement | null;
      if (s.typing || s.pcOn || t?.isContentEditable || t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      e.preventDefault();
      s.cycleNameTags();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Slot({
  icon,
  off = false,
  label,
  text,
  active,
  disabled,
  onClick,
  badge,
}: {
  icon: PixelIconName;
  off?: boolean;
  label: string;
  text: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={`${text} · ${label}`}
      className="cozy-btn relative h-10 w-10 p-0 max-sm:h-9 max-sm:w-9"
    >
      <PixelIcon name={icon} off={off} size={18} />
      {badge !== undefined && (
        <span className="absolute -top-2.5 -right-2.5 grid h-5 min-w-5 place-items-center border-2 border-cozy-red-deep bg-cozy-red px-1 text-[11px] leading-none text-cozy-paper-light">
          {badge}
        </span>
      )}
    </button>
  );
}
