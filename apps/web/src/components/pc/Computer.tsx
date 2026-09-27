"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/game/store";
import { COZY } from "@/lib/cozy";
import { CharacterSprite } from "../CharacterSprite";
import { CozyTitle, PixelIcon } from "../Cozy";
import { Desktop } from "./Desktop";
import { PowerIcon } from "./icons";
import { useNotes } from "./useNotes";

type Phase = "booting" | "login" | "welcome" | "desktop" | "loggingOff" | "shuttingDown";

const BOOT_MS = 1800;
const WELCOME_MS = 900;
const SHUTDOWN_MIN_MS = 1300;

/**
 * El computador del escritorio: un monitor de madera en el centro de la pantalla (sin taparla toda)
 * con un sistema operativo estilo XP en la paleta cozy. Se sale apagándolo, como un PC de verdad.
 */
export function Computer({ profile, onOff }: { profile: Profile; onOff: () => void }) {
  const [phase, setPhase] = useState<Phase>("booting");
  const notes = useNotes();
  const busy = useRef(false);

  useEffect(() => {
    if (phase === "booting") {
      const t = setTimeout(() => setPhase("login"), BOOT_MS);
      return () => clearTimeout(t);
    }
    if (phase === "welcome") {
      const t = setTimeout(() => setPhase("desktop"), WELCOME_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  /** Guarda lo pendiente (con una pausa mínima para que se lea la pantalla) y sigue. */
  const leave = async (next: "loggingOff" | "shuttingDown") => {
    if (busy.current) return;
    busy.current = true;
    setPhase(next);
    await Promise.all([notes.flush(), new Promise((r) => setTimeout(r, SHUTDOWN_MIN_MS))]);
    busy.current = false;
    if (next === "shuttingDown") onOff();
    else setPhase("login");
  };

  const on = phase !== "shuttingDown";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center p-3">
      {/* Monitor: marco de madera con el botón de encendido abajo. */}
      <div
        className="pointer-events-auto flex flex-col rounded-[10px] border-[3px] border-cozy-frame bg-cozy-wood p-2.5 pb-0 sm:p-3 sm:pb-0"
        style={{ boxShadow: "inset 0 0 0 2px var(--color-cozy-wood-light), 6px 6px 0 rgb(20 10 24 / 0.45)" }}
      >
        <div
          className="relative h-[min(620px,calc(100vh-10rem))] w-[min(980px,calc(100vw-2.5rem))] overflow-hidden rounded-[4px] border-[3px] border-cozy-frame bg-cozy-void font-pixel"
          role="application"
          aria-label="Computador"
        >
          {phase === "booting" && <BootScreen />}
          {phase === "login" && <LoginScreen profile={profile} onLogin={() => setPhase("welcome")} onShutdown={() => void leave("shuttingDown")} />}
          {phase === "welcome" && <XpBands center={<CozyTitle className="text-5xl">bienvenido</CozyTitle>} />}
          {phase === "desktop" && (
            <Desktop
              profile={profile}
              notes={notes}
              onLogOff={() => void leave("loggingOff")}
              onShutdown={() => void leave("shuttingDown")}
            />
          )}
          {(phase === "loggingOff" || phase === "shuttingDown") && (
            <XpBands
              center={
                <div className="text-center text-cozy-paper-light">
                  <CozyTitle className="text-4xl">{phase === "shuttingDown" ? "apagando…" : "cerrando sesión…"}</CozyTitle>
                  <p className="mt-3 text-[14px]">Guardando tus notas</p>
                </div>
              }
            />
          )}
        </div>

        <div className="flex h-9 items-center justify-between px-2">
          <span className="font-pixel text-[13px] font-semibold text-cozy-paper-dark">Hyvento</span>
          <button
            type="button"
            onClick={() => phase !== "booting" && void leave("shuttingDown")}
            aria-label="Apagar el computador"
            title="Apagar"
            className="flex items-center gap-2 text-cozy-paper-dark hover:text-cozy-paper-light"
          >
            <span className="h-2.5 w-2.5 border-2 border-cozy-frame" style={{ background: on ? "#5ea247" : COZY.red }} />
            <span className="grid h-6 w-6 place-items-center border-2 border-current">
              <PowerIcon size={12} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pantalla de arranque: el logo en pixel y la barra de bloques que avanza. */
function BootScreen() {
  return (
    <div className="cozy-void grid h-full place-items-center text-cozy-paper-light">
      <div className="flex flex-col items-center gap-7">
        <CozyTitle className="text-5xl leading-none sm:text-6xl">Hyvento OS</CozyTitle>
        <div className="relative h-6 w-48 overflow-hidden border-2 border-cozy-frame bg-cozy-paper-light p-[3px] shadow-[inset_0_0_0_2px_var(--color-cozy-wood-light)]">
          <div className="pc-boot-blocks flex h-full gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-full w-3 bg-[#5ea247]" />
            ))}
          </div>
        </div>
      </div>
      <p className="absolute bottom-4 text-[13px] text-cozy-paper-dark">La cabaña del equipo Hyvento</p>
    </div>
  );
}

/** Fondo de las pantallas del sistema: franjas de madera arriba y abajo, cielo en el medio (como XP). */
function XpBands({ center, footer }: { center: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="h-[13%] shrink-0 border-b-[3px] border-cozy-frame bg-cozy-wood shadow-[inset_0_-2px_0_var(--color-cozy-wood-light)]" />
      <div
        className="grid min-h-0 flex-1 place-items-center"
        style={{ background: `radial-gradient(circle, rgb(255 255 255 / 0.18) 1px, transparent 1.4px) 0 0 / 16px 16px, ${COZY.sky}` }}
      >
        {center}
      </div>
      <div className="flex h-[13%] shrink-0 items-center border-t-[3px] border-cozy-frame bg-cozy-wood px-5 shadow-[inset_0_2px_0_var(--color-cozy-wood-light)]">
        {footer}
      </div>
    </div>
  );
}

/** Inicio de sesión estilo XP: solo aparece tu usuario (cada quien ve lo suyo en cualquier PC). */
function LoginScreen({ profile, onLogin, onShutdown }: { profile: Profile; onLogin: () => void; onShutdown: () => void }) {
  return (
    <XpBands
      center={
        <div className="grid w-full max-w-3xl grid-cols-1 items-center gap-8 px-6 text-cozy-paper-light sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col items-center gap-3 text-center sm:items-end sm:text-right">
            <div className="cozy-panel flex items-center gap-2 px-3.5 py-2 text-cozy-ink">
              <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" />
              <span className="text-[18px] leading-none font-semibold">Hyvento</span>
            </div>
            <p className="max-w-[24ch] text-[15px] leading-relaxed">Para comenzar, haz clic en tu usuario</p>
          </div>
          <span aria-hidden className="hidden h-40 w-[3px] bg-cozy-paper-light/50 sm:block" />
          <button type="button" onClick={onLogin} autoFocus className="cozy-panel group flex items-center gap-4 justify-self-center p-3 pr-5 text-left sm:justify-self-start">
            <span className="border-2 border-cozy-frame bg-[#5d9c46]">
              <CharacterSprite avatar={profile.avatar} look={profile.look} dir="right" className="w-16" />
            </span>
            <span className="text-cozy-ink">
              <span className="block text-xl font-semibold">{profile.name}</span>
              <span className="text-[14px] text-cozy-ink-soft group-hover:text-cozy-ink">Iniciar sesión</span>
            </span>
          </button>
        </div>
      }
      footer={
        <button type="button" onClick={onShutdown} className="cozy-btn cozy-btn-danger text-[14px]">
          <PowerIcon size={13} />
          Apagar el equipo
        </button>
      }
    />
  );
}
