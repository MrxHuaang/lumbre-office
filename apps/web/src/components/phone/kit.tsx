"use client";

// Piezas comunes de las pantallas del celular: el contexto (teclas y navegación), las teclas de
// función de abajo, los títulos, las listas con selección y los íconos pixel a color.
import { createContext, useContext, useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { placeLabel } from "@hyvento/map";
import type { Weather } from "@hyvento/shared";
import { useShallow } from "zustand/react/shallow";
import { useMediaStore } from "@/game/media";
import { ICON_INK } from "@/game/phone/iconos";
import { useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "../Cozy";
import type { PhoneAppId } from "@/game/phone/iconos";

/** Teclas del celular (las del teclado de verdad se traducen a estas). `char:x` = una letra escrita. */
export type PhoneKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "*" | "#"
  | "up" | "down" | "left" | "right" | "ok" | "softL" | "softR" | "call" | "end" | "back"
  /** Esc del teclado de verdad: salir de donde se está (si la pantalla no lo usa, es la tecla derecha). */
  | "esc"
  | `char:${string}`;

/**
 * Devuelve true si la pantalla usó la tecla; si no, el celular hace lo de siempre (volver, colgar).
 * `physical` = vino del teclado de verdad (escribiendo, un "5" es un 5 y no la j/k/l del multi-toque).
 */
export type KeyHandler = (k: PhoneKey, physical: boolean) => boolean;

export interface SoftLabels {
  left?: string;
  center?: string;
  right?: string;
}

export type PhoneScreen =
  | { kind: "home" }
  | { kind: "menu" }
  | { kind: "app"; id: PhoneAppId; params?: AppParams };

/** Para abrir Mensajes en una pestaña, con texto ya escrito (desde Contactos: "@Nombre "). */
export interface AppParams {
  compose?: { text?: string; scope?: "proximity" | "global" };
  /** Se abrió con Enter desde la cabaña: Esc guarda el celular y se vuelve al juego. */
  quick?: boolean;
}

export interface PhoneCtx {
  keys: MutableRefObject<KeyHandler | null>;
  setSoft: (s: SoftLabels) => void;
  go: (s: PhoneScreen) => void;
  /** Vuelve al menú (desde una app) o a la pantalla de inicio. */
  back: () => void;
  home: () => void;
  /** Guarda el celular; `after` corre cuando ya bajó (sacar la foto, abrir un perfil). */
  close: (after?: () => void) => void;
}

export const PhoneContext = createContext<PhoneCtx | null>(null);

export function usePhone(): PhoneCtx {
  const ctx = useContext(PhoneContext);
  if (!ctx) throw new Error("usePhone fuera del celular");
  return ctx;
}

/**
 * La pantalla que está a la vista recibe las teclas y pone los rótulos de las teclas de función.
 * Una sola por vez: cada app maneja sus sub-pantallas con su propio estado.
 */
export function usePhoneKeys(handler: KeyHandler, soft: SoftLabels) {
  const ctx = usePhone();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn: KeyHandler = (k, physical) => ref.current(k, physical);
    ctx.keys.current = fn;
    return () => {
      if (ctx.keys.current === fn) ctx.keys.current = null;
    };
  }, [ctx]);
  const { left, center, right } = soft;
  useEffect(() => ctx.setSoft({ left, center, right }), [ctx, left, center, right]);
}

/** Tecla de dirección desde el teclado numérico (2 arriba, 8 abajo, 4 izquierda, 6 derecha). */
export function dirOf(k: PhoneKey): "up" | "down" | "left" | "right" | null {
  if (k === "up" || k === "2") return "up";
  if (k === "down" || k === "8") return "down";
  if (k === "left" || k === "4") return "left";
  if (k === "right" || k === "6") return "right";
  return null;
}

/** Barra de título de una app (madera, como los paneles de la cabaña). */
export function ScreenTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex h-[17px] shrink-0 items-center justify-between bg-cozy-wood px-1.5 text-[11px] leading-none font-semibold text-cozy-paper-light">
      <span className="truncate">{children}</span>
      {right !== undefined && <span className="shrink-0 pl-1">{right}</span>}
    </div>
  );
}

/** Lista con una fila elegida que siempre queda a la vista. */
export function SelectList<T>({
  items,
  index,
  render,
  onPick,
  empty,
}: {
  items: T[];
  index: number;
  render: (item: T, selected: boolean) => ReactNode;
  onPick: (i: number) => void;
  empty?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A mano y no con scrollIntoView: ese también correría la cabaña (el <main> tiene overflow oculto).
    const b = box.current;
    const el = b?.children[index] as HTMLElement | undefined;
    if (!b || !el) return;
    if (el.offsetTop < b.scrollTop) b.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = el.offsetTop + el.offsetHeight - b.clientHeight;
  }, [index]);
  if (items.length === 0) return <div className="grid flex-1 place-items-center px-2 text-center text-[11px] text-cozy-ink-soft">{empty}</div>;
  return (
    <div ref={box} className="phone-scroll relative flex-1 overflow-y-auto">
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          className={`block w-full border-b border-cozy-paper-dark px-1.5 py-[3px] text-left text-[11px] leading-tight ${
            i === index ? "bg-cozy-sky text-cozy-paper-light" : "text-cozy-ink"
          }`}
        >
          {render(it, i === index)}
        </button>
      ))}
    </div>
  );
}

/** Un ícono pixel a color (filas de letras, ver `ICON_INK`). */
export function PixelArt({ rows, size, className }: { rows: string[]; size: number; className?: string }) {
  const w = rows[0]?.length ?? 1;
  return (
    <svg width={size} height={(size * rows.length) / w} viewBox={`0 0 ${w} ${rows.length}`} shapeRendering="crispEdges" aria-hidden className={className}>
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ICON_INK[ch] ?? ch} />)),
      )}
    </svg>
  );
}

/** Mensaje centrado que se va solo (guardado, enviado). */
export function Flash({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 border-2 border-cozy-frame bg-cozy-paper-light px-2 py-2 text-center text-[12px] text-cozy-ink shadow-[3px_3px_0_rgb(20_10_24/0.5)]">
      {children}
    </div>
  );
}

/**
 * Con quién hay audio ahora (lo que antes decía el HUD arriba): "Cerca de Ana y Camilo", "En Club con …"
 * o el estado de la conexión. null = nadie cerca.
 */
export function useHearingText(): string | null {
  const status = useMediaStore((s) => s.status);
  const names = useMediaStore(useShallow((s) => Object.keys(s.hearing).map((id) => s.participants[id]?.name ?? "Alguien")));
  const zone = useOfficeStore((s) => s.zone);
  if (status === "connecting") return "Conectando audio…";
  if (status === "unavailable") return "Audio y video no disponibles";
  if (names.length === 0) return null;
  const shown = names.length > 3 ? `${names.slice(0, 2).join(", ")} y ${names.length - 2} más` : names.join(", ");
  return zone?.isolated ? `En ${zone.name} con ${shown}` : `Cerca de ${shown}`;
}

/** Nombre del lugar donde estoy (zona, puerta de una oficina o el nivel). */
export function usePlaceText(): string {
  const place = useOfficeStore((s) => s.place);
  const zoneNames = useOfficeStore((s) => s.zoneNames);
  return placeLabel(place, (id) => zoneNames[id]);
}

/**
 * Ícono y color de cada clima (despejado de noche es la luna), como el que había en el HUD. Parcial a
 * propósito: un clima nuevo (p. ej. `nieve`) sale con la nube hasta que se agregue aquí su ícono.
 */
const WEATHER_ICON: Partial<Record<Weather, { icon: PixelIconName; color: string }>> = {
  despejado: { icon: "sun", color: "#ffcf4a" },
  nublado: { icon: "cloud", color: "#c8c4d0" },
  lluvia: { icon: "rain", color: "#7fb4ec" },
  tormenta: { icon: "storm", color: "#b8a8ff" },
  niebla: { icon: "fog", color: "#d8c8b0" },
};

export function WeatherIcon({ size = 9 }: { size?: number }) {
  const weather = useOfficeStore((s) => s.weather);
  const night = useOfficeStore((s) => s.night);
  const { icon, color } =
    weather === "despejado" && night ? { icon: "moon" as const, color: "#fdf0c8" } : (WEATHER_ICON[weather] ?? { icon: "cloud" as const, color: "#c8c4d0" });
  return <PixelIcon name={icon} size={size} color={color} />;
}
