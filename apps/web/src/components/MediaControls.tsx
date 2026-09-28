"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { media, useMediaStore } from "@/game/media";
import { NAME_TAG_LABEL, selectFocusing, useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "./Cozy";
import { EmotePicker, useEmoteKey } from "./EmotePicker";
import { takePhoto, usePhotoCounting, usePhotoKey } from "./PhotoPanels";

/**
 * Barra de herramientas (abajo al centro, estilo Stardew): micrófono, cámara, pantalla y chat. `children`
 * va al final de la barra (el casillero de lo que tienes en la mano), así no depende de su ancho.
 */
export function MediaControls({ children }: { children?: ReactNode } = {}) {
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

  return (
    <div className="cozy-panel absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 p-2.5">
      {emotes && <EmotePicker onClose={() => setEmotes(false)} />}
      <Slot
        n={1}
        icon="mic"
        off={!mic}
        label={mediaDown ?? (mic ? "Silenciar micrófono" : "Activar micrófono")}
        text={mic ? "Mic" : "Mic off"}
        active={mic}
        disabled={!ready}
        onClick={() => void media.toggleMic()}
      />
      <Slot
        n={2}
        icon="cam"
        off={!cam}
        label={mediaDown ?? (cam ? "Apagar cámara" : "Encender cámara")}
        text={cam ? "Cámara" : "Cam off"}
        active={cam}
        disabled={!ready}
        onClick={() => void media.toggleCam()}
      />
      <Slot
        n={3}
        icon="screen"
        label={mediaDown ?? (screen ? "Dejar de compartir" : "Compartir pantalla")}
        text={screen ? "Compartiendo" : "Pantalla"}
        active={screen}
        disabled={!ready}
        onClick={() => void media.toggleScreen()}
      />
      <Slot
        n={4}
        icon="chat"
        label={chatOpen ? "Cerrar chat" : "Abrir chat (Enter)"}
        text="Chat"
        active={chatOpen}
        disabled={false}
        onClick={() => setChatOpen(!chatOpen)}
        badge={!chatOpen && !focusing && unread > 0 ? unread : undefined}
      />
      <Slot
        n={5}
        icon="smile"
        label="Emotes (T)"
        text="Emotes"
        active={emotes}
        disabled={false}
        onClick={() => setEmotes((v) => !v)}
      />
      <Slot
        n={6}
        icon="camera"
        label="Sacar una foto (P)"
        text={shooting.counting ? "3, 2, 1…" : "Foto"}
        active={shooting.counting}
        disabled={shooting.busy}
        onClick={takePhoto}
      />
      <Slot
        n={7}
        icon="tag"
        off={nameTags === "oculto"}
        label={`${NAME_TAG_LABEL[nameTags]} (N para cambiar; al pasar el mouse se ve el nombre completo)`}
        text={nameTags === "completo" ? "Nombres" : nameTags === "corto" ? "Cortos" : "Ocultos"}
        active={nameTags !== "corto"}
        disabled={false}
        onClick={cycleNameTags}
      />
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
  n,
  icon,
  off = false,
  label,
  text,
  active,
  disabled,
  onClick,
  badge,
}: {
  n: number;
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
      title={label}
      className="cozy-btn relative h-[58px] w-[62px] flex-col gap-1 p-1 text-[12px] max-sm:h-12 max-sm:w-12"
    >
      <span className="absolute top-0.5 left-1 text-[10px] text-cozy-ink-soft">{n}</span>
      <PixelIcon name={icon} off={off} size={22} />
      <span className="max-w-full truncate max-sm:hidden">{text}</span>
      {badge !== undefined && (
        <span className="absolute -top-2.5 -right-2.5 grid h-5 min-w-5 place-items-center border-2 border-cozy-red-deep bg-cozy-red px-1 text-[11px] leading-none text-cozy-paper-light">
          {badge}
        </span>
      )}
    </button>
  );
}
