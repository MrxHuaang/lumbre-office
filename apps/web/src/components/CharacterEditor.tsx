"use client";

import {
  ACCESSORIES,
  HAIR_STYLES,
  HUMAN_AVATARS,
  type Accessory,
  type Direction,
  type HumanAvatar,
  type Look,
} from "@hyvento/shared";
import { useRef, useState } from "react";
import { ACCESSORY_LABEL, HAIR_COLORS, HAIR_STYLE_LABEL, INK_COLORS, presetLook, SKIN_TONES } from "@/lib/look-palette";
import { RISO } from "@/lib/riso";
import { CharacterSprite } from "./CharacterSprite";

/** Personaje de alguien: uno fijo (`avatar`) o uno personalizado (`look`). */
export interface Appearance {
  avatar: HumanAvatar;
  look: Look | null;
}

/** Tinta de la tarjeta de cada personaje fijo (semitono + disco). */
const AVATAR_INK: Record<HumanAvatar, string> = {
  ada: RISO.pink,
  bruno: RISO.blue,
  carla: RISO.yellow,
  dario: RISO.green,
  eva: RISO.orange,
  fede: RISO.violet,
};

const TURN: Direction[] = ["down", "left", "up", "right"];

export function CharacterEditor({ value, onChange }: { value: Appearance; onChange: (v: Appearance) => void }) {
  const custom = value.look !== null;
  // Al volver a "Personajes" y regresar, se recupera lo que ya se había armado.
  const lastLook = useRef<Look | null>(value.look);

  const setLook = (look: Look) => {
    lastLook.current = look;
    onChange({ avatar: value.avatar, look });
  };

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Tipo de personaje" className="flex flex-wrap gap-2">
        <Tab selected={!custom} onClick={() => onChange({ avatar: value.avatar, look: null })}>
          Personajes
        </Tab>
        <Tab selected={custom} onClick={() => setLook(lastLook.current ?? presetLook(value.avatar))}>
          Crea el tuyo
        </Tab>
      </div>

      {custom ? (
        <LookEditor look={value.look!} avatar={value.avatar} onChange={setLook} />
      ) : (
        <PresetGrid selected={value.avatar} onSelect={(avatar) => onChange({ avatar, look: null })} />
      )}
    </div>
  );
}

function Tab({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`riso-pill px-4 py-2 ${selected ? "bg-riso-navy text-riso-paper" : "hover:bg-riso-yellow"}`}
    >
      {children}
    </button>
  );
}

/** Los seis personajes fijos, cada uno con su tinta. */
function PresetGrid({ selected, onSelect }: { selected: HumanAvatar; onSelect: (a: HumanAvatar) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-[18px]">
      {HUMAN_AVATARS.map((a) => {
        const isSelected = a === selected;
        const ink = AVATAR_INK[a];
        return (
          <button
            key={a}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(a)}
            className="flex aspect-[1/1.1] cursor-pointer flex-col overflow-hidden border-2 border-riso-navy bg-riso-cream p-0 transition-[transform,box-shadow] duration-[120ms]"
            style={{
              boxShadow: isSelected ? `6px 6px 0 ${RISO.navy}` : "none",
              transform: isSelected ? "translate(-3px, -3px)" : "none",
            }}
          >
            <span
              className="relative grid flex-1 place-items-center"
              style={{ background: `radial-gradient(circle, ${ink} 2px, transparent 2.4px) 0 0 / 9px 9px` }}
            >
              <span className="absolute aspect-square w-[62%] rounded-full opacity-90 mix-blend-multiply" style={{ background: ink }} />
              <CharacterSprite avatar={a} className="relative w-[46%]" />
            </span>
            <span className="flex items-center justify-between border-t-2 border-riso-navy px-3 py-2.5 text-[13px] font-semibold">
              <span className="capitalize">{a}</span>
              <span aria-hidden>{isSelected ? "●" : "○"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LookEditor({ look, avatar, onChange }: { look: Look; avatar: HumanAvatar; onChange: (l: Look) => void }) {
  const [dir, setDir] = useState<Direction>("down");
  const set = <K extends keyof Look>(key: K, v: Look[K]) => onChange({ ...look, [key]: v });
  const toggle = (a: Accessory) =>
    set("accessories", look.accessories.includes(a) ? look.accessories.filter((x) => x !== a) : [...look.accessories, a]);
  const usesAccent = look.accessories.includes("cap") || look.accessories.includes("headphones");

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      {/* Vista previa: el personaje caminando, con botones para girarlo. */}
      <div className="flex flex-col self-start border-2 border-riso-navy bg-riso-cream max-sm:mx-auto max-sm:w-44 sm:sticky sm:top-4">
        <div
          className="relative grid aspect-square place-items-center"
          style={{ background: `radial-gradient(circle, ${look.shirt} 2px, transparent 2.4px) 0 0 / 9px 9px` }}
        >
          <span
            className="absolute aspect-square w-[66%] rounded-full opacity-90 mix-blend-multiply"
            style={{ background: look.shirt }}
          />
          <CharacterSprite avatar={avatar} look={look} dir={dir} walking className="relative w-[58%]" />
        </div>
        <div className="flex items-center justify-between gap-2 border-t-2 border-riso-navy px-3 py-2 text-[13px] font-semibold max-sm:justify-center">
          <span className="max-sm:hidden">Vista previa</span>
          <button
            type="button"
            onClick={() => setDir(TURN[(TURN.indexOf(dir) + 1) % TURN.length]!)}
            className="underline underline-offset-2"
          >
            Girar ↻
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Partir de">
          <div className="flex flex-wrap gap-1.5">
            {HUMAN_AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                title={`Colores de ${a}`}
                aria-label={`Usar los colores de ${a}`}
                onClick={() => {
                  const base = presetLook(a);
                  onChange({ ...look, skin: base.skin, hair: base.hair, shirt: base.shirt, pants: base.pants });
                }}
                className="border-[1.5px] border-riso-navy bg-riso-cream p-0.5 hover:bg-riso-yellow"
              >
                <CharacterSprite avatar={a} className="w-7" />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Piel">
          <Swatches colors={SKIN_TONES} value={look.skin} onChange={(v) => set("skin", v)} />
        </Field>

        <Field label="Peinado">
          <Chips
            options={HAIR_STYLES.map((h) => ({ id: h, label: HAIR_STYLE_LABEL[h] }))}
            isOn={(h) => h === look.hairStyle}
            onToggle={(h) => set("hairStyle", h)}
          />
        </Field>

        <Field label="Color de pelo">
          <Swatches colors={HAIR_COLORS} value={look.hair} onChange={(v) => set("hair", v)} />
        </Field>

        <Field label="Camisa">
          <Swatches colors={INK_COLORS} value={look.shirt} onChange={(v) => set("shirt", v)} />
        </Field>

        <Field label="Pantalón">
          <Swatches colors={INK_COLORS} value={look.pants} onChange={(v) => set("pants", v)} />
        </Field>

        <Field label="Accesorios">
          <Chips
            options={ACCESSORIES.map((a) => ({ id: a, label: ACCESSORY_LABEL[a] }))}
            isOn={(a) => look.accessories.includes(a)}
            onToggle={toggle}
          />
        </Field>

        {usesAccent && (
          <Field label="Color de gorra y audífonos">
            <Swatches colors={INK_COLORS} value={look.accent} onChange={(v) => set("accent", v)} />
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">{label}</span>
      {children}
    </div>
  );
}

function Chips<T extends string>({
  options,
  isOn,
  onToggle,
}: {
  options: { id: T; label: string }[];
  isOn: (id: T) => boolean;
  onToggle: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = isOn(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.id)}
            className={`rounded-full border-[1.5px] border-riso-navy px-3 py-1 text-xs font-semibold ${
              on ? "bg-riso-navy text-riso-paper" : "bg-riso-cream hover:bg-riso-yellow"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Muestras de color sugeridas y, al final, un selector libre para cualquier otro color. */
function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (hex: string) => void }) {
  const current = value.toLowerCase();
  const inPalette = colors.some((c) => c.toLowerCase() === current);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={c.toLowerCase() === current}
          onClick={() => onChange(c)}
          className="h-7 w-7 border-2 border-riso-navy transition-[transform,box-shadow] duration-100"
          style={{
            background: c,
            boxShadow: c.toLowerCase() === current ? `3px 3px 0 ${RISO.navy}` : "none",
            transform: c.toLowerCase() === current ? "translate(-1.5px, -1.5px)" : "none",
          }}
        />
      ))}
      <label
        title="Otro color"
        className="relative grid h-7 w-7 cursor-pointer place-items-center border-2 border-dashed border-riso-navy text-sm font-semibold transition-[transform,box-shadow] duration-100"
        style={
          inPalette
            ? { background: RISO.cream }
            : { background: value, borderStyle: "solid", boxShadow: `3px 3px 0 ${RISO.navy}`, transform: "translate(-1.5px, -1.5px)" }
        }
      >
        {inPalette && "+"}
        <span className="sr-only">Otro color</span>
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
