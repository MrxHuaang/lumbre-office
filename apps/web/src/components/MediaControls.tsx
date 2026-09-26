"use client";

import { media, useMediaStore } from "@/game/media";
import { useOfficeStore } from "@/game/store";

/** Barra de llamada (abajo al centro): micrófono, cámara, pantalla y chat. */
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
    <div className="riso-panel absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full p-2 text-riso-navy">
      <ControlButton
        label={mic ? "Silenciar micrófono" : "Activar micrófono"}
        text={mic ? "Mic on" : "Mic off"}
        active={mic}
        disabled={!ready}
        onClick={() => void media.toggleMic()}
      >
        {mic ? <MicIcon /> : <MicOffIcon />}
      </ControlButton>
      <ControlButton
        label={cam ? "Apagar cámara" : "Encender cámara"}
        text={cam ? "Cam on" : "Cam off"}
        active={cam}
        disabled={!ready}
        onClick={() => void media.toggleCam()}
      >
        {cam ? <CamIcon /> : <CamOffIcon />}
      </ControlButton>
      <ControlButton
        label={screen ? "Dejar de compartir" : "Compartir pantalla"}
        text={screen ? "Compartiendo" : "Pantalla"}
        active={screen}
        activeClass="bg-riso-pink"
        disabled={!ready}
        onClick={() => void media.toggleScreen()}
      >
        <ScreenIcon />
      </ControlButton>
      <ControlButton
        label={chatOpen ? "Cerrar chat" : "Abrir chat (Enter)"}
        text="Chat"
        active={chatOpen}
        activeClass="bg-riso-yellow"
        disabled={false}
        onClick={() => setChatOpen(!chatOpen)}
      >
        <ChatIcon />
        {unread > 0 && !chatOpen && (
          <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-riso-navy bg-riso-pink px-1 text-[11px] leading-none">
            {unread}
          </span>
        )}
      </ControlButton>
    </div>
  );
}

function ControlButton({
  children,
  label,
  text,
  active,
  activeClass = "bg-riso-green",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  text: string;
  active: boolean;
  activeClass?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`riso-pill relative px-3 sm:px-4 ${active ? activeClass : ""}`}
    >
      {children}
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.25, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function MicIcon() {
  return (
    <svg {...svg}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg {...svg}>
      <path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5 2.2M5 11a7 7 0 0 0 11.9 5M19 11c0 .7-.1 1.4-.3 2M12 18v3M3 3l18 18" />
    </svg>
  );
}
function CamIcon() {
  return (
    <svg {...svg}>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m16 10 6-3v10l-6-3" />
    </svg>
  );
}
function CamOffIcon() {
  return (
    <svg {...svg}>
      <path d="M16 16v1a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2m4 0h5a1 1 0 0 1 1 1v3l6-3v10M3 3l18 18" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg {...svg}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}
function ScreenIcon() {
  return (
    <svg {...svg}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
