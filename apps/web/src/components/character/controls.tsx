"use client";

// Piezas del editor de personaje: secciones, opciones con miniatura y muestras de color.
import type { SheetDirection } from "@hyvento/map/art";
import type { LookInput } from "@hyvento/shared";
import { useId } from "react";
import { ChibiThumb, type Crop } from "./ChibiThumb";

/** Una sección con título (y una ayuda corta opcional debajo del título). */
export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 id={id} className="text-[14px] font-semibold text-cozy-ink-soft">
          {title}
        </h3>
        {hint && <span className="text-[12px] leading-snug text-cozy-placeholder">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Grupo de secciones separado por una línea punteada (Arriba, Abajo, Zapatos…). */
export function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t-2 border-dashed border-cozy-paper-dark pt-4 first:border-t-0 first:pt-0">{children}</div>
  );
}

export interface Option<T extends string> {
  id: T;
  label: string;
  /** El look con esta opción puesta, para la miniatura. */
  look: LookInput;
}

/**
 * Opciones con miniatura: cada una muestra el personaje con esa opción puesta. Sirve para elegir una
 * (peinado, gorra…) o para prender y apagar cada una (rubor, pecas): eso lo deciden `isOn` y `onPick`.
 */
export function OptionGrid<T extends string>({
  options,
  isOn,
  onPick,
  crop,
  dir,
  disabled = false,
}: {
  options: Option<T>[];
  isOn: (id: T) => boolean;
  onPick: (id: T) => void;
  crop: Crop;
  dir?: SheetDirection;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={isOn(o.id)}
          disabled={disabled}
          onClick={() => onPick(o.id)}
          className="cozy-btn flex-col justify-start gap-1 px-1 pt-1 pb-1.5"
        >
          <span className="grid h-[60px] w-full place-items-center bg-cozy-paper-light">
            <ChibiThumb look={o.look} crop={crop} dir={dir} />
          </span>
          <span className="text-center text-[12px] leading-[1.15] text-balance">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Recuadro de las muestras: rojo en la elegida (como el de Stardew) y oscuro en la que tiene el foco del
 * teclado; si coinciden, rojo punteado. Con clases y no en línea, para no taparle el foco al navegador.
 */
const SWATCH_RING =
  "outline-offset-1 data-[on=true]:outline-3 data-[on=true]:outline-cozy-red " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cozy-frame " +
  "[&[data-on=true]:focus-visible]:outline-dashed [&[data-on=true]:focus-visible]:outline-cozy-red";

/** Muestras de color sugeridas y, al final, un selector libre para cualquier otro color. */
export function Swatches({
  colors,
  value,
  onChange,
  label,
}: {
  colors: readonly string[];
  value: string;
  onChange: (hex: string) => void;
  /** Para lectores de pantalla: de qué es el color. */
  label: string;
}) {
  const current = value.toLowerCase();
  const inPalette = colors.some((c) => c.toLowerCase() === current);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {colors.map((c, i) => {
        const on = c.toLowerCase() === current;
        return (
          <button
            key={c}
            type="button"
            // El código del color no le dice nada a quien usa lector de pantalla: mejor su lugar en la fila.
            aria-label={`${label}: muestra ${i + 1} de ${colors.length}`}
            aria-pressed={on}
            data-on={on}
            onClick={() => onChange(c)}
            className={`h-8 w-8 border-2 border-cozy-frame ${SWATCH_RING}`}
            style={{ background: c }}
          />
        );
      })}
      {/* overflow-hidden: el <input type="color"> nativo es más ancho que la casilla y en el celular movía el
          panel. El foco lo tiene el input (invisible), así que el recuadro lo muestra la casilla con :has. */}
      <label
        title="Otro color"
        data-on={!inPalette}
        className="relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden border-2 border-dashed border-cozy-frame text-sm font-semibold outline-offset-1 data-[on=true]:border-solid data-[on=true]:outline-3 data-[on=true]:outline-cozy-red has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cozy-frame [&[data-on=true]:has(:focus-visible)]:outline-dashed [&[data-on=true]:has(:focus-visible)]:outline-cozy-red"
        style={{ background: inPalette ? "var(--color-cozy-paper-light)" : value }}
      >
        {inPalette && "+"}
        <span className="sr-only">{`${label}: otro color`}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
