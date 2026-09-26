"use client";

import { media, useMediaStore } from "@/game/media";
import { useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "./Cozy";

/** Barra de herramientas (abajo al centro, estilo Stardew): micrófono, cámara, pantalla y chat. */
export function MediaControls() {
  const status = useMediaStore((s) => s.status);
  const mic = useMediaStore((s) => s.mic);
  const cam = useMediaStore((s) => s.cam);
  const screen = useMediaStore((s) => s.screen);
  const chatOpen = useOfficeStore((s) => s.chatOpen);
  const unread = useOfficeStore((s) => s.unread);
  const setChatOpen = useOfficeStore((s) => s.setChatOpen);
  const ready = status === "connected";

  return (
    <div className="cozy-panel absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 p-2.5">
      <Slot
        n={1}
        icon="mic"
        off={!mic}
        label={mic ? "Silenciar micrófono" : "Activar micrófono"}
        text={mic ? "Mic" : "Mic off"}
        active={mic}
        disabled={!ready}
        onClick={() => void media.toggleMic()}
      />
      <Slot
        n={2}
        icon="cam"
        off={!cam}
        label={cam ? "Apagar cámara" : "Encender cámara"}
        text={cam ? "Cámara" : "Cam off"}
        active={cam}
        disabled={!ready}
        onClick={() => void media.toggleCam()}
      />
      <Slot
        n={3}
        icon="screen"
        label={screen ? "Dejar de compartir" : "Compartir pantalla"}
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
        badge={!chatOpen && unread > 0 ? unread : undefined}
      />
    </div>
  );
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
