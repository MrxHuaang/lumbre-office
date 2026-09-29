"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFacilidadStore } from "@/game/facilidad";
import { media, useMediaStore } from "@/game/media";
import { NAME_TAG_LABEL, selectFocusing, useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "./Cozy";
import { DevicePanel } from "./DevicePanel";
import { EmotePicker, useEmoteKey } from "./EmotePicker";
import { takePhoto, usePhotoCounting, usePhotoKey } from "./PhotoPanels";

/**
 * La barra de abajo al centro (estilo Stardew), en una franja baja: a la izquierda audio y video
 * (micrófono, cámara, pantalla y el engranaje), al centro la fila de la mochila (`children`) y a la
 * derecha chat, emotes, foto y nombres, más lo que se hace con lo de la mano (`actions`) y `tail`.
 * En pantallas angostas los botones van en una fila y la mochila debajo; en el celular emotes, foto
 * y nombres se esconden en "⋯". Publica su alto en `--cozy-bar-top` (en el <main>) para que el chat,
 * los avisos y las tiras de las mesas se paren justo encima.
 */
export function MediaControls({ children, actions, tail }: { children?: ReactNode; actions?: ReactNode; tail?: ReactNode } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const publish = () => host.style.setProperty("--cozy-bar-top", `${Math.ceil(host.getBoundingClientRect().bottom - el.getBoundingClientRect().top) + 8}px`);
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
  // También se abre desde Ajustes y la paleta de comandos (game/facilidad.ts).
  const devicesOpen = useFacilidadStore((s) => s.devices);
  const setDevicesOpen = useFacilidadStore((s) => s.setDevices);
  const closeDevices = useCallback(() => setDevicesOpen(false), [setDevicesOpen]);
  const [more, setMore] = useState(false);

  // Emotes, foto y nombres: en la barra desde tablet; en el celular, dentro de "⋯".
  const extras = (
    <>
      <Slot icon="smile" label="Emotes" hotkey="T" active={emotes} onClick={() => setEmotes((v) => !v)} />
      <Slot
        icon="camera"
        label={shooting.counting ? "Foto: 3, 2, 1…" : "Sacar una foto"}
        hotkey="P"
        active={shooting.counting}
        disabled={shooting.busy}
        onClick={takePhoto}
      />
      <Slot
        icon="tag"
        off={nameTags === "oculto"}
        label={`${NAME_TAG_LABEL[nameTags]} (al pasar el mouse se ve el nombre completo)`}
        hotkey="N"
        active={nameTags !== "corto"}
        onClick={cycleNameTags}
      />
    </>
  );

  return (
    <div
      ref={ref}
      className="cozy-panel absolute bottom-2 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col items-center gap-1.5 p-1.5 lg:flex-row lg:gap-2"
    >
      {emotes && <EmotePicker onClose={() => setEmotes(false)} />}
      {devicesOpen && <DevicePanel onClose={closeDevices} />}
      {/* En pantallas anchas este envoltorio desaparece (lg:contents) y los grupos quedan a los lados de la mochila. */}
      <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 lg:contents">
        <div role="toolbar" aria-label="Audio y video" className="flex items-center gap-1 lg:order-1">
          <Slot
            icon="mic"
            off={!mic}
            live={mic}
            label={mediaDown ?? (mic ? "Micrófono prendido: clic para silenciar" : "Micrófono apagado: clic para activar")}
            active={mic}
            disabled={!ready}
            onClick={() => void media.toggleMic()}
          />
          <Slot
            icon="cam"
            off={!cam}
            live={cam}
            label={mediaDown ?? (cam ? "Cámara prendida: clic para apagar" : "Cámara apagada: clic para encender")}
            active={cam}
            disabled={!ready}
            onClick={() => void media.toggleCam()}
          />
          <Slot
            icon="screen"
            live={screen}
            label={mediaDown ?? (screen ? "Compartiendo pantalla: clic para dejar de compartir" : "Compartir pantalla")}
            active={screen}
            disabled={!ready}
            onClick={() => void media.toggleScreen()}
          />
          {/* Audio y video: funciona sin LiveKit (la prueba es local), por eso nunca se deshabilita. */}
          <button
            type="button"
            onClick={() => setDevicesOpen(true)}
            aria-label="Audio y video: elegir y probar micrófono, cámara y parlantes"
            aria-haspopup="dialog"
            title="Audio y video: elegir y probar"
            className="cozy-btn size-9 p-0 max-sm:size-8"
          >
            <PixelIcon name="gear" size={14} />
          </button>
        </div>
        <div
          role="toolbar"
          aria-label="Chat y extras"
          className="flex items-center gap-1 border-l-2 border-cozy-ink-soft/30 pl-1.5 lg:order-3 lg:border-l-0 lg:pl-0"
        >
          <Slot
            icon="chat"
            label={chatOpen ? "Cerrar chat" : "Abrir chat"}
            hotkey="↵"
            active={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
            badge={!chatOpen && !focusing && unread > 0 ? unread : undefined}
          />
          <span className="flex items-center gap-1 max-sm:hidden">{extras}</span>
          <span className="sm:hidden">
            <MoreMenu open={more} setOpen={setMore} active={emotes || shooting.counting}>
              {extras}
            </MoreMenu>
          </span>
        </div>
        {(actions || tail) && (
          <div className="flex items-center gap-1.5 empty:hidden lg:order-4">
            {actions}
            {tail}
          </div>
        )}
      </div>
      {children && <div className="max-w-full lg:order-2 lg:border-x-2 lg:border-cozy-ink-soft/30 lg:px-2">{children}</div>}
    </div>
  );
}

/** "⋯" del celular: lo que no cabe en la barra, en una tablita que sale hacia arriba. */
function MoreMenu({ open, setOpen, active, children }: { open: boolean; setOpen: (v: boolean) => void; active: boolean; children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  // Se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return (
    <span ref={box} className="relative block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Más: emotes, foto y nombres"
        title="Más: emotes, foto y nombres"
        data-on={active || undefined}
        className="cozy-btn size-8 p-0"
      >
        <PixelIcon name="dots" size={16} />
      </button>
      {open && (
        <span role="group" aria-label="Más" className="cozy-panel absolute right-0 bottom-full mb-2 flex gap-1 p-1.5">
          {children}
        </span>
      )}
    </span>
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

/**
 * Un botón chico de la barra: solo el ícono (el nombre va en el `title` y el `aria-label`) y, si tiene
 * atajo, la tecla chiquita en la esquina. `off` tacha en rojo (apagado) y `live` lo pinta de verde (al aire).
 */
function Slot({
  icon,
  off = false,
  live = false,
  label,
  hotkey,
  active,
  disabled = false,
  onClick,
  badge,
}: {
  icon: PixelIconName;
  off?: boolean;
  live?: boolean;
  label: string;
  hotkey?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const key = hotkey === "↵" ? "Enter" : hotkey;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      aria-keyshortcuts={key}
      title={key ? `${label} (${key})` : label}
      data-off={off || undefined}
      data-live={live || undefined}
      className="cozy-btn bar-slot relative size-9 p-0 max-sm:size-8"
    >
      <PixelIcon name={icon} off={off} size={16} />
      {hotkey && <span className="bar-slot-key max-sm:hidden">{hotkey}</span>}
      {badge !== undefined && (
        <span className="absolute -top-2 -right-2 z-10 grid h-4 min-w-4 place-items-center border-2 border-cozy-red-deep bg-cozy-red px-0.5 text-[10px] leading-none text-cozy-paper-light">
          {badge}
        </span>
      )}
    </button>
  );
}
