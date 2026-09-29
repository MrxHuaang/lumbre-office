"use client";

// Fondos del escritorio: la capa de fondo, la ventana "Fondo de pantalla" con las miniaturas y el
// menú del clic derecho en el escritorio vacío. Todo vive en el PC (se carga al prenderlo).
import { useEffect, useState } from "react";
import { COZY } from "@/lib/cozy";
import { CabinShowcase } from "../CabinShowcase";
import { dibujarFondo, FONDO_H, FONDO_W, LISO_COLOR } from "./fondos-arte";
import { estacionDelFondo, FONDOS, guardarFondo, leerFondo, type FondoId } from "./fondos";
import { SEASON_TEXT, type Season } from "@hyvento/shared";

/** `localStorage`, o null si el navegador no lo deja tocar (modo privado, cookies bloqueadas). */
function almacen(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** El fondo elegido por esta persona en este navegador; al cambiarlo se guarda. */
export function useFondo(): [FondoId, (id: FondoId) => void] {
  const [id, setId] = useState<FondoId>(() => leerFondo(almacen()));
  const elegir = (next: FondoId) => {
    setId(next);
    guardarFondo(almacen(), next);
  };
  return [id, elegir];
}

// Cada dibujo se pinta una vez y se reusa (el fondo grande y su miniatura son la misma imagen).
const imagenes = new Map<string, string>();
function imagenDe(id: FondoId, season: Season): string {
  const key = id === "estacion" ? `${id}:${season}` : id;
  let src = imagenes.get(key);
  if (!src) {
    const canvas = document.createElement("canvas");
    canvas.width = FONDO_W;
    canvas.height = FONDO_H;
    const g = canvas.getContext("2d");
    if (!g) return "";
    dibujarFondo(g, id, season);
    src = canvas.toDataURL();
    imagenes.set(key, src);
  }
  return src;
}

/** La imagen se arma después de montar (usa <canvas>), sin frenar el primer cuadro del escritorio. */
function useImagen(id: FondoId, season: Season, activo = true): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!activo) return;
    const t = setTimeout(() => setSrc(imagenDe(id, season)), 0);
    return () => clearTimeout(t);
  }, [id, season, activo]);
  return activo ? src : null;
}

const PUNTITOS = (color: string, tint: string) => `radial-gradient(circle, ${tint} 1px, transparent 1.4px) 0 0 / 16px 16px, ${color}`;

/** La estación se toma al abrir el escritorio: cambia pocas veces al año, no hace falta un reloj. */
const useEstacion = () => useState(() => estacionDelFondo(Date.now()))[0];

/** El fondo del escritorio (capa de abajo, sin eventos) con el nombre "Hyvento OS". */
export function FondoEscritorio({ id }: { id: FondoId }) {
  const season = useEstacion();
  const css = id === "cielo" || id === "liso";
  const src = useImagen(id, season, !css);
  const background =
    id === "cielo"
      ? PUNTITOS(COZY.sky, "rgb(255 255 255 / 0.16)")
      : id === "liso"
        ? PUNTITOS(LISO_COLOR, "rgb(255 255 255 / 0.22)")
        : src
          ? `url(${src}) center bottom / cover no-repeat`
          : COZY.void;
  return (
    <div aria-hidden className="pixelated pointer-events-none absolute inset-0 overflow-hidden" style={{ background }}>
      {id === "cielo" && <CabinShowcase className="absolute right-[-4%] bottom-[-10%] w-[72%] max-w-[760px]" />}
      {/* Sombra sólida: se lee igual sobre el cielo, la noche, la madera o la nieve. */}
      <p
        className="absolute top-4 right-6 text-[15px] font-semibold text-cozy-paper-light"
        style={{ textShadow: `2px 2px 0 ${COZY.frame}, -1px -1px 0 ${COZY.frame}, 1px -1px 0 ${COZY.frame}, -1px 1px 0 ${COZY.frame}` }}
      >
        Hyvento OS
      </p>
    </div>
  );
}

function Miniatura({ id, season }: { id: FondoId; season: Season }) {
  const src = useImagen(id, season);
  return (
    <span
      aria-hidden
      className="pixelated block aspect-[192/112] w-full border-2 border-cozy-frame"
      style={{ background: src ? `url(${src}) center / cover no-repeat` : COZY.void }}
    />
  );
}

/** La ventana "Fondo de pantalla": miniaturas; la elegida lleva el recuadro rojo y se aplica al tiro. */
export function FondosApp({ actual, onElegir }: { actual: FondoId; onElegir: (id: FondoId) => void }) {
  const season = useEstacion();
  return (
    <div className="cozy-scroll min-h-0 flex-1 overflow-y-auto p-3">
      <p className="mb-2.5 text-[13px] text-cozy-ink-soft">Elige cómo se ve tu escritorio. Se guarda en este navegador.</p>
      <div role="group" aria-label="Fondos de pantalla" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {FONDOS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={actual === f.id}
            title={f.descripcion}
            onClick={() => onElegir(f.id)}
            className="cozy-btn flex-col items-stretch gap-1.5 p-1.5 text-[12px]"
          >
            <Miniatura id={f.id} season={season} />
            <span className="truncate text-center">
              {f.nombre}
              {f.id === "estacion" && ` · ${SEASON_TEXT[season]}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Menú del clic derecho en el escritorio vacío. Se cierra con un clic fuera o con Esc. */
export function MenuEscritorio({ at, onClose, onCambiarFondo }: { at: { x: number; y: number }; onClose: () => void; onCambiarFondo: () => void }) {
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-ctx-escritorio]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      data-ctx-escritorio
      role="menu"
      aria-label="Opciones del escritorio"
      className="cozy-panel absolute z-[1500] w-52 py-1 text-[13px]"
      style={{ left: at.x, top: at.y }}
    >
      <button
        type="button"
        role="menuitem"
        autoFocus
        onClick={() => {
          onClose();
          onCambiarFondo();
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-semibold hover:bg-cozy-paper-dark"
      >
        <FondoIcon size={16} />
        Cambiar fondo
      </button>
    </div>
  );
}

/** Ícono de la app: un cuadrito con cerros y sol, en el mismo trazo que los de `icons.tsx`. */
export function FondoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden>
      <rect x="4" y="6" width="24" height="20" fill={COZY.sky} stroke={COZY.frame} strokeWidth="2" />
      <path d="M5 22l7-7 5 5 4-3 6 5v3H5z" fill={COZY.green} />
      <rect x="20" y="10" width="4" height="4" fill={COZY.paperLight} />
      <rect x="4" y="6" width="24" height="20" fill="none" stroke={COZY.frame} strokeWidth="2" />
    </svg>
  );
}
