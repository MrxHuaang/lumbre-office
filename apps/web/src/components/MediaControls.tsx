"use client";

import { media, useMediaStore } from "@/game/media";
import { useOfficeStore } from "@/game/store";

export function MediaControls() {
  const status = useMediaStore((s) => s.status);
  const mic = useMediaStore((s) => s.mic);
  const cam = useMediaStore((s) => s.cam);
  const screen = useMediaStore((s) => s.screen);
  const hearingCount = useMediaStore((s) => Object.keys(s.hearing).length);
  const zone = useOfficeStore((s) => s.zone);
  const ready = status === "connected";
  const people = `${hearingCount} ${hearingCount === 1 ? "persona" : "personas"}`;

  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-line bg-panel/92 p-1.5 shadow-2xl backdrop-blur">
      <ControlButton
        label={mic ? "Silenciar micrófono" : "Activar micrófono"}
        active={mic}
        disabled={!ready}
        onClick={() => void media.toggleMic()}
      >
        {mic ? <MicIcon /> : <MicOffIcon />}
      </ControlButton>
      <ControlButton
        label={cam ? "Apagar cámara" : "Encender cámara"}
        active={cam}
        disabled={!ready}
        onClick={() => void media.toggleCam()}
      >
        {cam ? <CamIcon /> : <CamOffIcon />}
      </ControlButton>
      <ControlButton
        label={screen ? "Dejar de compartir" : "Compartir pantalla"}
        active={screen}
        disabled={!ready}
        onClick={() => void media.toggleScreen()}
      >
        <ScreenIcon />
      </ControlButton>
      <span className="px-2 text-xs text-muted" title={zone?.isolated ? `En ${zone.name} se oye a todos los que están adentro, sin importar la distancia` : "Personas que te pueden oír y ver"}>
        {status === "connecting"
          ? "Conectando audio…"
          : status === "unavailable"
            ? "Audio/video no disponible"
            : zone?.isolated
              ? `En ${zone.name} · ${hearingCount === 0 ? "solo tú" : people}`
              : hearingCount === 0
                ? "Nadie cerca"
                : `${people} cerca`}
      </span>
    </div>
  );
}

function ControlButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
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
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-accent text-accent-ink" : "bg-panel-2 text-text hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

const svg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

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
function ScreenIcon() {
  return (
    <svg {...svg}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
