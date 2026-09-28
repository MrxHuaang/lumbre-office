"use client";

import { placeLabel } from "@hyvento/map";
import { MANUAL_STATUSES, SEASON_TEXT, WEATHER_TEXT, recipeById, seasonOf, type PresenceStatus, type Season, type Weather } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCocinaStore } from "@/game/cocina";
import { useShallow } from "zustand/react/shallow";
import { useMediaStore } from "@/game/media";
import { sendStatus } from "@/game/network";
import { notificationsSupported, selectNotifyOn, setNotificationsEnabled, useNotifyStore } from "@/game/notify";
import { sfx } from "@/game/sfx";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { useAchievementStore } from "@/game/achievements";
import { STATUS_HEX } from "@/lib/cozy";
import { PixelIcon, type PixelIconName } from "./Cozy";
import { BirthdayChip, Confetti, FocusChip } from "./EventosHud";
import { GameClockChip } from "./GameClockChip";
import { PersonMenu } from "./PersonMenu";
import { PointsCounter } from "./PointsPanels";
import { GiftChip, PersonActions } from "./social/SocialOverlays";
import { SoundSettings } from "./SoundControl";
import { CallChip } from "./PhonePanels";

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

const useLabelOf = () => {
  const zoneNames = useOfficeStore((s) => s.zoneNames);
  return (p: string) => placeLabel(p, (id) => zoneNames[id]);
};

/**
 * Arriba a la izquierda, en una sola fila corta: el menú (marca, estado y todo lo que no se usa a cada
 * rato), los puntos, dónde estás con el clima, lo del momento (regalos, cumpleaños, llamada, a quién oyes)
 * y los atajos de siempre (mi oficina, foco y paredes). Lo demás vive dentro del menú.
 */
export function Hud(props: HudProps) {
  return (
    <div className="absolute top-3 left-3 flex max-w-[calc(100%-13rem)] flex-wrap items-center gap-2 text-[14px] md:max-w-[calc(100%-20rem)]">
      <MainMenu {...props} />
      <PointsCounter />
      <PlaceChip />
      <GameClockChip />
      <GiftChip />
      <BirthdayChip />
      <CallChip />
      <HearingChip />
      <QuickTools />
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
      <FocusChip />
      {indoors && (
        <button
          onClick={() => useOfficeStore.getState().setPrivateWalls(!walls)}
          aria-pressed={walls}
          className="cozy-btn h-[34px] w-[34px] p-0"
          title={walls ? "Paredes altas: solo ves la sala donde estás. Clic para verla toda" : "Paredes bajas: ves toda la casa. Clic para subirlas"}
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
        className="cozy-panel flex h-[38px] items-center gap-2 px-3 hover:brightness-105"
      >
        <span className="relative">
          <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" />
          {me && (
            <span className="absolute -right-1.5 -bottom-1">
              <StatusDot status={me.status} size="sm" />
            </span>
          )}
        </span>
        <span className="text-[18px] leading-none font-semibold max-sm:sr-only">Hyvento</span>
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
          </MenuGroup>

          <MenuGroup label="Ajustes">
            <MenuToggle icon="walls" on={walls} onClick={() => useOfficeStore.getState().setPrivateWalls(!walls)}>
              Paredes altas adentro
            </MenuToggle>
            <NotifyToggle />
            <div className="px-2 pt-1.5 pb-1">
              <SoundSettings />
            </div>
          </MenuGroup>

          {isAdmin && (
            <MenuGroup label="Administración">
              <MenuItem icon="board" onClick={act(onAdmin)}>
                Administrar equipo
              </MenuItem>
              <MenuItem icon="home" onClick={act(() => useOfficeStore.getState().setWorldEditing(true))}>
                Editar la casa
              </MenuItem>
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

/** Ícono y color de cada clima (despejado de noche es la luna). */
const WEATHER_ICON: Record<Weather, { icon: PixelIconName; color: string }> = {
  despejado: { icon: "sun", color: "var(--color-cozy-gold)" },
  nublado: { icon: "cloud", color: "#8a8a96" },
  lluvia: { icon: "rain", color: "var(--color-cozy-sky)" },
  tormenta: { icon: "storm", color: "#4a3f8a" },
  niebla: { icon: "fog", color: "#a8977f" },
  nieve: { icon: "snow", color: "#6f93bf" },
};

/** Ícono y color de cada estación. */
const SEASON_ICON: Record<Season, { icon: PixelIconName; color: string }> = {
  primavera: { icon: "flower", color: "#e088a4" },
  verano: { icon: "sun", color: "var(--color-cozy-gold)" },
  otono: { icon: "leaf", color: "#c0602a" },
  invierno: { icon: "snow", color: "#6f93bf" },
};

/**
 * Dónde estás, con la estación y el clima de afuera en íconos (lo decide el servidor: todos ven el mismo).
 * El texto del clima solo se ve en pantallas anchas; siempre está al pasar el mouse.
 */
function PlaceChip() {
  const zone = useOfficeStore((s) => s.zone);
  const place = useOfficeStore((s) => s.place);
  const weather = useOfficeStore((s) => s.weather);
  const night = useOfficeStore((s) => s.night);
  const labelOf = useLabelOf();
  // La estación cambia a fin de mes: basta con mirarla al montar y cuando cambia el clima.
  const season = useMemo(() => seasonOf(Date.now()), [weather]);
  const w = weather === "despejado" && night ? { icon: "moon" as const, color: "#4a3f8a" } : WEATHER_ICON[weather];
  const s = SEASON_ICON[season];
  const where = labelOf(place);
  return (
    <div
      className="cozy-chip flex h-[34px] items-center gap-1.5 px-3"
      title={`${where}${zone?.isolated ? " (zona privada: solo te oyen quienes están aquí)" : ""} · ${SEASON_TEXT[season]} · ${WEATHER_TEXT[weather]}`}
    >
      {zone?.isolated && <PixelIcon name="lock" size={13} color="var(--color-cozy-wood)" />}
      <span className="max-w-[12rem] truncate">{where}</span>
      <span aria-hidden className="h-4 border-l-2 border-cozy-paper-dark" />
      <PixelIcon name={s.icon} size={13} color={s.color} />
      <PixelIcon name={w.icon} size={14} color={w.color} />
      <span className="max-xl:sr-only">{WEATHER_TEXT[weather]}</span>
      <EnergyBadge />
    </div>
  );
}

/** La energía de un plato de la cocina (camino más rápido un rato). */
function EnergyBadge() {
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
    <span className="ml-1 flex items-center gap-1 border-l-2 border-cozy-paper-dark pl-2 text-cozy-ink-soft" title={`${name}: caminas más rápido un rato`}>
      <PixelIcon name="bolt" size={12} color="var(--color-cozy-gold)" />
      {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Energía"}
    </span>
  );
}

/** Con quién tienes audio ahora mismo (el estado de la conexión se ve en los botones de la barra). */
function HearingChip() {
  const names = useMediaStore(
    useShallow((s) => Object.keys(s.hearing).map((id) => s.participants[id]?.name ?? "Alguien")),
  );
  const zone = useOfficeStore((s) => s.zone);

  if (names.length === 0) return null;

  const shown = names.length > 3 ? `${names.slice(0, 2).join(", ")} y ${names.length - 2} más` : names.join(", ");
  return (
    <div
      className="cozy-chip flex h-[34px] max-w-[16rem] items-center gap-2 truncate px-3"
      title={
        zone?.isolated
          ? `En ${zone.name} se oye a todos los que están adentro, sin importar la distancia`
          : "Personas que te pueden oír y ver"
      }
    >
      <span className="h-2.5 w-2.5 shrink-0 bg-[#5ea247] outline-2 outline-cozy-frame" />
      <span className="truncate">{zone?.isolated ? `En ${zone.name} con ${shown}` : `Cerca de ${shown}`}</span>
    </div>
  );
}

const PEOPLE_OPEN_KEY = "hyvento:conectados-abierto";

function loadPeopleOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(PEOPLE_OPEN_KEY);
    if (v === "1" || v === "0") return v === "1";
  } catch {
    // sin almacenamiento: lo de siempre
  }
  return window.innerWidth >= 900;
}

/** Panel de conectados (arriba a la derecha): quién está y dónde. */
export function PeoplePanel() {
  const players = useOfficeStore((s) => s.players);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const place = useOfficeStore((s) => s.place);
  const labelOf = useLabelOf();
  const openProfile = useAchievementStore((s) => s.openProfile);
  // Abierto o plegado se recuerda; la primera vez, en pantallas angostas empieza plegado para no tapar el mapa.
  const [open, setOpenState] = useState(() => loadPeopleOpen());
  const setOpen = (fn: (v: boolean) => boolean) =>
    setOpenState((v) => {
      const next = fn(v);
      try {
        localStorage.setItem(PEOPLE_OPEN_KEY, next ? "1" : "0");
      } catch {
        // sin almacenamiento: vale solo para esta visita
      }
      return next;
    });
  // Yo primero; el resto por nombre.
  const people = Object.values(players).sort((a, b) =>
    a.sessionId === sessionId ? -1 : b.sessionId === sessionId ? 1 : a.name.localeCompare(b.name),
  );

  return (
    <section className="cozy-panel pointer-events-auto w-full p-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-cozy-wood px-3 py-2 text-cozy-paper-light"
      >
        <span className="text-[16px] font-semibold">Conectados</span>
        <span className="flex items-center gap-2 text-[14px]">
          {people.length}
          <PixelIcon name="chevron" size={12} className={open ? "rotate-180" : ""} />
        </span>
      </button>
      {open && (
        <ul className="cozy-scroll max-h-[45vh] overflow-y-auto">
          {people.map((p) => (
            <li key={p.sessionId} className="flex items-center border-b-2 border-cozy-paper-dark pr-2 last:border-b-0">
              {/* Clic en alguien: su perfil (estadísticas y logros). */}
              <button
                type="button"
                onClick={() => openProfile(p.sessionId === sessionId ? "me" : p.userId)}
                title={`Ver el perfil de ${p.name}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left hover:bg-cozy-paper-dark"
              >
                <StatusDot status={p.status} title={STATUS_LABEL[p.status]} />
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  {p.name}
                  {p.sessionId === sessionId && " (tú)"}
                </span>
                <span className="max-w-[45%] truncate text-[12px] text-cozy-ink-soft">
                  {labelOf(p.sessionId === sessionId ? place : p.place)}
                </span>
              </button>
              {p.sessionId !== sessionId && <PersonMenu person={p} onProfile={() => openProfile(p.userId)} />}
              {p.sessionId !== sessionId && <PersonActions to={{ userId: p.userId, name: p.name }} />}
            </li>
          ))}
        </ul>
      )}
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
