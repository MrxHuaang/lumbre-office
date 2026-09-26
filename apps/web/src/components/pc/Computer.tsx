"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/game/store";
import { RISO } from "@/lib/riso";
import { CharacterSprite } from "../CharacterSprite";
import { Overprint, RisoLogo } from "../Riso";
import { Desktop } from "./Desktop";
import { PowerIcon } from "./icons";
import { useNotes } from "./useNotes";

type Phase = "booting" | "login" | "welcome" | "desktop" | "loggingOff" | "shuttingDown";

const BOOT_MS = 1800;
const WELCOME_MS = 900;
const SHUTDOWN_MIN_MS = 1300;

/**
 * El computador del escritorio: un monitor en el centro de la pantalla (sin taparla toda) con un
 * sistema operativo estilo XP en tintas RISO. Se sale apagándolo, como un PC de verdad.
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
      {/* Monitor: marco de tinta con el botón de encendido abajo. */}
      <div
        className="pointer-events-auto flex flex-col rounded-[18px] bg-riso-navy p-2.5 pb-0 sm:p-3 sm:pb-0"
        style={{ boxShadow: `8px 8px 0 rgb(31 42 68 / 0.35)` }}
      >
        <div
          className="relative h-[min(620px,calc(100vh-10rem))] w-[min(980px,calc(100vw-2.5rem))] overflow-hidden rounded-[6px] border-2 border-black bg-black"
          role="application"
          aria-label="Computador"
        >
          {phase === "booting" && <BootScreen />}
          {phase === "login" && <LoginScreen profile={profile} onLogin={() => setPhase("welcome")} onShutdown={() => void leave("shuttingDown")} />}
          {phase === "welcome" && <XpBands center={<p className="font-display text-4xl text-riso-paper italic">bienvenido</p>} />}
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
                <div className="text-center text-riso-paper">
                  <p className="font-display text-3xl italic">{phase === "shuttingDown" ? "apagando…" : "cerrando sesión…"}</p>
                  <p className="mt-2 text-xs opacity-80">Guardando tus notas</p>
                </div>
              }
            />
          )}
        </div>

        <div className="flex h-9 items-center justify-between px-2">
          <span className="font-display text-[11px] tracking-[0.2em] text-riso-paper/50 uppercase">Hyvento</span>
          <button
            type="button"
            onClick={() => phase !== "booting" && void leave("shuttingDown")}
            aria-label="Apagar el computador"
            title="Apagar"
            className="flex items-center gap-2 text-riso-paper/70 hover:text-riso-paper"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: on ? RISO.green : RISO.orange, boxShadow: on ? `0 0 6px ${RISO.green}` : "none" }}
            />
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-current">
              <PowerIcon size={12} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pantalla de arranque: el logo sobreimpreso y la barra de bloques que avanza. */
function BootScreen() {
  return (
    <div className="grid h-full place-items-center bg-riso-paper font-plex text-riso-navy">
      <div className="flex flex-col items-center gap-6">
        <Overprint
          lines={["Hyvento OS"]}
          back={RISO.blue}
          front={RISO.pink}
          offset={[4, 3]}
          className="text-5xl leading-none tracking-tight sm:text-6xl"
        />
        <div className="relative h-5 w-44 overflow-hidden rounded-[4px] border-2 border-riso-navy bg-riso-cream p-[2px]">
          <div className="pc-boot-blocks flex h-full gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-full w-3 bg-riso-blue" />
            ))}
          </div>
        </div>
      </div>
      <p className="absolute bottom-4 text-[11px] text-riso-muted">Oficina virtual · Equipo Hyvento</p>
    </div>
  );
}

/** Fondo de las pantallas del sistema: franjas de tinta arriba y abajo, azul en el medio (como XP). */
function XpBands({ center, footer }: { center: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="h-[13%] shrink-0 border-b-2 border-riso-pink bg-riso-navy" />
      <div
        className="grid min-h-0 flex-1 place-items-center"
        style={{ background: `radial-gradient(circle, rgb(255 255 255 / 0.14) 1px, transparent 1.3px) 0 0 / 14px 14px, ${RISO.blue}` }}
      >
        {center}
      </div>
      <div className="flex h-[13%] shrink-0 items-center border-t-2 border-riso-yellow bg-riso-navy px-5">{footer}</div>
    </div>
  );
}

/** Inicio de sesión estilo XP: solo aparece tu usuario (cada quien ve lo suyo en cualquier PC). */
function LoginScreen({ profile, onLogin, onShutdown }: { profile: Profile; onLogin: () => void; onShutdown: () => void }) {
  return (
    <XpBands
      center={
        <div className="grid w-full max-w-3xl grid-cols-1 items-center gap-8 px-6 text-riso-paper sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col items-center gap-3 text-center sm:items-end sm:text-right">
            <RisoLogo />
            <p className="max-w-[24ch] text-[13px] leading-relaxed">Para comenzar, haz clic en tu usuario</p>
          </div>
          <span aria-hidden className="hidden h-40 w-0.5 bg-riso-paper/40 sm:block" />
          <button
            type="button"
            onClick={onLogin}
            autoFocus
            className="group flex items-center gap-4 justify-self-center rounded-[6px] p-2 text-left hover:bg-riso-navy/30 sm:justify-self-start"
          >
            <span className="border-2 border-riso-paper bg-riso-cream transition-shadow group-hover:shadow-[4px_4px_0_var(--color-riso-yellow)]">
              <CharacterSprite avatar={profile.avatar} look={profile.look} className="w-16" />
            </span>
            <span>
              <span className="font-display block text-xl">{profile.name}</span>
              <span className="text-xs opacity-80 group-hover:underline">Iniciar sesión →</span>
            </span>
          </button>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onShutdown}
          className="flex items-center gap-2 text-[13px] font-semibold text-riso-paper hover:underline"
        >
          <span className="grid h-6 w-6 place-items-center border-[1.5px] border-riso-paper bg-riso-pink text-riso-navy">
            <PowerIcon size={13} />
          </span>
          Apagar el equipo
        </button>
      }
    />
  );
}
