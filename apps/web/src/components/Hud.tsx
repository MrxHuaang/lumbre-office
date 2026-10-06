"use client";

import { MANUAL_STATUSES, recipeById, type PresenceStatus } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { useCocinaStore } from "@/game/cocina";
import { useShallow } from "zustand/react/shallow";
import { sendStatus } from "@/game/network";
import { notificationsSupported, selectNotifyOn, setNotificationsEnabled, useNotifyStore } from "@/game/notify";
import { sfx } from "@/game/sfx";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { useAchievementStore } from "@/game/achievements";
import { STATUS_HEX } from "@/lib/cozy";
import { PixelIcon, type PixelIconName } from "./Cozy";
import { BirthdayChip, Confetti, FocusChip } from "./EventosHud";
import { FestivalChip, GameClockChip } from "./GameClockChip";
import { Minimap } from "./Minimap";
import { usePuedo } from "@/game/permisos";
import { GiftChip } from "./social/SocialOverlays";
import { SoundSettings } from "./SoundControl";
import { CallChip } from "./PhonePanels";
import { PhoneButton } from "./phone/PhoneButton";
import { PaletteButton } from "./facilidad/FacilidadLayer";
import { useFacilidadStore } from "@/game/facilidad";
import { usePrefsStore } from "@/lib/prefs";
import { ComunicacionChips } from "./comunicacion/ComunicacionChips";
import { openAnnounce } from "@/game/comunicacion";
import { openDirector } from "@/game/director";
import { IrEstacionButton } from "./IrEstacionButton";

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  dnd: "No molestar",
  away: "Ausente",
  meeting: "En reunión",
};

interface HudProps {
  isAdmin: boolean;
  onEditProfile: () => void;
  onEditCharacter: () => void;
  onMyProfile: () => void;
  onAdmin: () => void;
  onLogout: () => void;
}

/**
 * Arriba a la izquierda, en una sola fila corta: el menú (marca, estado y todo lo que no se usa a cada
 * rato), el celular, la hora del juego, lo del momento (energía, regalos, cumpleaños, llamada) y los atajos
 * de siempre (mi oficina, foco y paredes). Los puntos, dónde estás con el clima, a quién oyes, los
 * conectados y el chat viven en el celular (components/phone).
 * Publica dónde termina en `--cozy-hud-bottom` (en el <main>): en pantallas angostas la fila se parte
 * en dos o tres y el chat y los avisos se acomodan debajo sin taparla.
 */
export function Hud(props: HudProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const publish = () => host.style.setProperty("--cozy-hud-bottom", `${Math.ceil(el.getBoundingClientRect().bottom - host.getBoundingClientRect().top)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    ro.observe(host);
    return () => {
      ro.disconnect();
      host.style.removeProperty("--cozy-hud-bottom");
    };
  }, []);
  return (
    // Todo a 34 px de alto. En el celular los conectados quedan como una ficha chica: la fila tiene más ancho.
    <div ref={ref} className="absolute top-3 left-3 flex max-w-[calc(100%-6.5rem)] flex-wrap items-center gap-1.5 text-[14px] md:max-w-[calc(100%-19.5rem)]">
      <MainMenu {...props} />
      <PhoneButton />
      <GameClockChip />
      <FestivalChip />
      <EnergyChip />
      <GiftChip />
      <BirthdayChip />
      <CallChip />
      <ComunicacionChips />
      <QuickTools />
      <PaletteButton />
      <Confetti />
    </div>
  );
}

/** Atajos que se usan a cada rato, juntos en una tablita: caminar a mi oficina, el foco y las paredes. */
function QuickTools() {
  const zone = useOfficeStore((s) => s.zone);
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const walkToZone = useOfficeStore((s) => s.walkToZone);
  const indoors = useOfficeStore((s) => s.indoors);
  const walls = useOfficeStore((s) => s.privateWalls);
  const awayFromOffice = Boolean(myOffice && zone?.id !== myOffice.zoneId);
  return (
    <div className="flex items-center gap-1">
      {awayFromOffice && myOffice && (
        <button
          onClick={() => walkToZone(myOffice.zoneId)}
          className="cozy-btn h-[34px] gap-1.5 px-2"
          title={`Caminar hasta ${myOffice.name}`}
          aria-label={`Ir a mi oficina (${myOffice.name})`}
        >
          <PixelIcon name="home" size={14} />
          <span className="max-lg:sr-only">Mi oficina</span>
        </button>
      )}
      <IrEstacionButton />
      <FocusChip />
      {indoors && (
        <button
          onClick={() => useOfficeStore.getState().setPrivateWalls(!walls)}
          aria-pressed={walls}
          className="cozy-btn h-[34px] w-[34px] p-0"
          title={walls ? "Paredes altas: solo ves la sala donde estás. Clic para ver toda la casa" : "Paredes bajas: ves toda la casa. Clic para subirlas"}
          aria-label={walls ? "Bajar las paredes" : "Subir las paredes"}
        >
          <PixelIcon name="walls" size={16} color={walls ? "var(--color-cozy-wood)" : "var(--color-cozy-ink-soft)"} />
        </button>
      )}
    </div>
  );
}

/** El menú principal: la marca con tu estado, y adentro perfil, cosas, ajustes y administración. */
function MainMenu({ isAdmin, onEditProfile, onEditCharacter, onMyProfile, onAdmin, onLogout }: HudProps) {
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const me = sessionId ? players[sessionId] : undefined;
  const walls = useOfficeStore((s) => s.privateWalls);
  const openPanel = useOfficeStore((s) => s.openPanel);
  const workMode = usePrefsStore((s) => s.workMode);
  // Editar la casa: admins y quien tenga el permiso (lo manda el servidor, que además lo valida).
  const houseEditor = usePuedo("editar-casa");
  const announcer = usePuedo("anunciar");
  const director = usePuedo("director");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const toggle = (v: boolean) => {
    if (v) sfx.uiOpen();
    else sfx.uiClose();
    setOpen(v);
  };
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
  }, [open]);
  // Cada acción cierra el menú.
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => toggle(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú"
        title={me ? `Menú · ${STATUS_LABEL[me.status]}` : "Menú"}
        className="cozy-panel flex h-[34px] items-center gap-2 px-2.5 hover:brightness-105"
      >
        <span className="relative">
          <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" />
          {me && (
            <span className="absolute -right-1.5 -bottom-1">
              <StatusDot status={me.status} size="sm" />
            </span>
          )}
        </span>
        <span className="text-[17px] leading-none font-semibold max-sm:sr-only">Hyvento</span>
        <PixelIcon name="chevron" size={12} className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div role="menu" className="cozy-panel cozy-scroll absolute top-full left-0 z-30 mt-3 max-h-[calc(100vh-6rem)] w-72 overflow-y-auto p-2">
          {me && (
            <div className="border-b-2 border-cozy-paper-dark px-2 pt-1 pb-2.5">
              <p className="truncate text-[15px] font-semibold">{me.name}</p>
              <p className="mt-1.5 mb-1 text-[12px] text-cozy-ink-soft">Tu estado</p>
              <div role="radiogroup" aria-label="Tu estado" className="grid grid-cols-2 gap-1">
                {MANUAL_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={me.status === s}
                    aria-pressed={me.status === s}
                    onClick={() => sendStatus(s)}
                    className="cozy-btn justify-start gap-1.5 px-2 py-1 text-[12px] whitespace-nowrap"
                  >
                    <StatusDot status={s} size="sm" />
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {me.status === "meeting" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-cozy-ink-soft">
                  <StatusDot status="meeting" size="sm" />
                  En reunión (automático). Elige otro para quitarlo.
                </p>
              )}
            </div>
          )}

          <MenuGroup>
            <MenuItem icon="trophy" onClick={act(onMyProfile)}>
              Mi perfil y logros
            </MenuItem>
            <MenuItem icon="smile" onClick={act(onEditCharacter)}>
              Mi personaje
            </MenuItem>
            <MenuItem icon="tag" onClick={act(onEditProfile)}>
              Editar perfil
            </MenuItem>
          </MenuGroup>

          <MenuGroup label="Mis cosas">
            {/* La mochila, las estadísticas y el personaje (bag/PlayerMenu.tsx); también con la tecla I. */}
            <MenuItem icon="bag" onClick={act(() => openPanel("backpack", false))}>
              <span className="flex-1">Mochila y estadísticas</span>
              <kbd className="cozy-kbd text-[11px]">I</kbd>
            </MenuItem>
            <MenuItem icon="fish" onClick={act(() => openPanel("fishAlbum", false))}>
              Álbum de pesca
            </MenuItem>
            <MenuItem icon="star" onClick={act(() => openPanel("logbook", false))}>
              Diario de exploración
            </MenuItem>
            <MenuItem icon="map" onClick={act(() => useFacilidadStore.getState().show("worldmap"))}>
              Mapa de la cabaña
            </MenuItem>
          </MenuGroup>

          <MenuGroup label="Ajustes">
            <MenuToggle icon="walls" on={walls} onClick={() => useOfficeStore.getState().setPrivateWalls(!walls)}>
              Paredes altas adentro
            </MenuToggle>
            <NotifyToggle />
            <MenuToggle icon="briefcase" on={workMode} onClick={() => usePrefsStore.getState().setWorkMode(!workMode)}>
              Modo trabajo
            </MenuToggle>
            <div className="px-2 pt-1.5 pb-1">
              <SoundSettings />
            </div>
            <MenuItem icon="gear" onClick={act(() => useFacilidadStore.getState().show("settings"))}>
              Más ajustes: sonido, movimiento…
            </MenuItem>
            <MenuItem icon="keyboard" onClick={act(() => useFacilidadStore.getState().show("shortcuts"))}>
              <span className="flex-1">Atajos y ayuda</span>
              <kbd className="cozy-kbd text-[11px]">?</kbd>
            </MenuItem>
          </MenuGroup>

          {(isAdmin || houseEditor || announcer || director) && (
            <MenuGroup label="Administración">
              {isAdmin && (
                <MenuItem icon="board" onClick={act(onAdmin)}>
                  Administrar equipo
                </MenuItem>
              )}
              {houseEditor && (
                <MenuItem icon="home" onClick={act(() => useOfficeStore.getState().setWorldEditing(true))}>
                  Editar la casa
                </MenuItem>
              )}
              {announcer && (
                <MenuItem icon="megaphone" onClick={act(() => openAnnounce())}>
                  Anuncio a toda la cabaña
                </MenuItem>
              )}
              {director && (
                <MenuItem icon="clapper" onClick={act(() => openDirector())}>
                  Panel del director
                </MenuItem>
              )}
            </MenuGroup>
          )}

          <MenuGroup>
            <MenuItem icon="power" onClick={act(onLogout)}>
              Cerrar sesión
            </MenuItem>
          </MenuGroup>
        </div>
      )}
    </div>
  );
}

function MenuGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="border-b-2 border-cozy-paper-dark py-1.5 last:border-b-0 last:pb-0">
      {label && <p className="px-2 pb-1 text-[12px] text-cozy-ink-soft">{label}</p>}
      {children}
    </div>
  );
}

/** La energía de un plato de la cocina (caminas más rápido un rato): solo se ve mientras dura. */
function EnergyChip() {
  const buff = useCocinaStore((s) => s.buff);
  const until = useCocinaStore((s) => s.buffUntil);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!buff) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [buff]);
  if (!buff) return null;
  const left = until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
  const name = recipeById(buff)?.name ?? "Un plato";
  return (
    <div className="cozy-chip flex h-[34px] items-center gap-1.5 px-3 text-cozy-ink-soft" title={`${name}: caminas más rápido un rato`}>
      <PixelIcon name="bolt" size={12} color="var(--color-cozy-gold)" />
      {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Energía"}
    </div>
  );
}

const MAP_OPEN_KEY = "hyvento:minimapa-abierto";

function loadMapOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(MAP_OPEN_KEY);
    if (v === "1" || v === "0") return v === "1";
  } catch {
    // sin almacenamiento: lo de siempre
  }
  return window.innerWidth >= 900;
}

/**
 * Arriba a la derecha: el minimapa, plegable. La lista de conectados vive en Contactos del celular; el
 * mapa queda afuera porque sirve mientras se camina (clic en alguien = ir hasta esa persona).
 */
export function MinimapPanel() {
  const count = useOfficeStore((s) => Object.keys(s.players).length);
  const [open, setOpenState] = useState(loadMapOpen);
  const toggle = () =>
    setOpenState((v) => {
      try {
        localStorage.setItem(MAP_OPEN_KEY, v ? "0" : "1");
      } catch {
        // sin almacenamiento: vale solo para esta visita
      }
      return !v;
    });
  return (
    <section className={`cozy-panel pointer-events-auto p-1 ${open ? "w-full max-md:w-[min(270px,calc(100vw-1.5rem))]" : "w-full max-md:w-auto"}`}>
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Minimapa: ${count} conectados`}
        title="Minimapa"
        className={`flex h-5 w-full items-center justify-between gap-3 bg-cozy-wood px-2 text-cozy-paper-light max-md:gap-2 ${open ? "" : "cozy-hit"}`}
      >
        <span className={`flex items-center gap-1.5 text-[14px] leading-none font-semibold ${open ? "" : "max-md:hidden"}`}>
          <PixelIcon name="steps" size={12} />
          Minimapa
        </span>
        <span className="flex items-center gap-2 text-[14px]">
          {count}
          <PixelIcon name="chevron" size={12} className={open ? "rotate-180" : ""} />
        </span>
      </button>
      {open && <Minimap />}
    </section>
  );
}

function StatusDot({ status, title, size = "md" }: { status: PresenceStatus; title?: string; size?: "sm" | "md" }) {
  return (
    <span
      title={title}
      className={`${size === "sm" ? "block h-2.5 w-2.5" : "h-3 w-3"} shrink-0 border-2 border-cozy-frame`}
      style={{ background: STATUS_HEX[status] ?? STATUS_HEX.available }}
    />
  );
}

function MenuItem({ children, icon, onClick }: { children: React.ReactNode; icon: PixelIconName; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-[14px] hover:bg-cozy-paper-dark">
      <PixelIcon name={icon} size={14} color="var(--color-cozy-wood)" />
      {children}
    </button>
  );
}

/** Avisos del navegador con Lumbre en segundo plano (ver game/notify.ts). El clic pide el permiso. */
function NotifyToggle() {
  const on = useNotifyStore(selectNotifyOn);
  const denied = useNotifyStore((s) => s.permission === "denied");
  if (!notificationsSupported()) return null;
  return (
    <MenuToggle
      icon="bell"
      on={on}
      onClick={() => {
        if (denied) {
          useOfficeStore.getState().notify("El navegador bloqueó los avisos: actívalos desde el candado de la barra de direcciones.", "warning");
          return;
        }
        void setNotificationsEnabled(!on).then((ok) => {
          if (!on && !ok) useOfficeStore.getState().notify("Sin permiso del navegador no podemos avisarte.", "warning");
        });
      }}
    >
      Avisos en segundo plano
    </MenuToggle>
  );
}

/** Un ajuste que se prende y se apaga (el menú queda abierto para ver el cambio). */
function MenuToggle({ children, icon, on, onClick }: { children: React.ReactNode; icon: PixelIconName; on: boolean; onClick: () => void }) {
  return (
    <button
      role="menuitemcheckbox"
      aria-checked={on}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-[14px] hover:bg-cozy-paper-dark"
    >
      <PixelIcon name={icon} size={14} color="var(--color-cozy-wood)" />
      <span className="flex-1">{children}</span>
      <span
        aria-hidden
        className={`relative h-4 w-7 shrink-0 border-2 border-cozy-frame ${on ? "bg-cozy-green" : "bg-cozy-paper-dark"}`}
      >
        <span className={`absolute top-0 h-full w-2.5 bg-cozy-paper-light ${on ? "right-0" : "left-0"}`} />
      </span>
    </button>
  );
}
