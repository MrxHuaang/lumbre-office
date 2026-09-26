"use client";

import {
  ACCESSORIES,
  HAIR_STYLES,
  HEADWEAR,
  HUMAN_AVATARS,
  OUTFITS,
  type Accessory,
  type Direction,
  type HairStyle,
  type HumanAvatar,
  type Look,
  type Outfit,
} from "@hyvento/shared";
import { useRef, useState } from "react";
import {
  ACCENT_ACCESSORIES,
  ACCENT_OUTFITS,
  ACCESSORY_LABEL,
  BASIC_ACCESSORIES,
  BASIC_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_STYLE_LABEL,
  INK_COLORS,
  joinEs,
  OUTFIT_LABEL,
  presetLook,
  SKIN_TONES,
} from "@/lib/look-palette";
import { CharacterSprite } from "./CharacterSprite";
import { PixelIcon } from "./Cozy";

/** Personaje de alguien: uno fijo (`avatar`) o uno personalizado (`look`). */
export interface Appearance {
  avatar: HumanAvatar;
  look: Look | null;
}

const TURN: Direction[] = ["down", "left", "up", "right"];

export function CharacterEditor({
  value,
  onChange,
  wardrobe = false,
}: {
  value: Appearance;
  onChange: (v: Appearance) => void;
  /** true = el probador de la tienda: todos los peinados, accesorios y conjuntos. */
  wardrobe?: boolean;
}) {
  const custom = value.look !== null;
  // Al volver a "Personajes" y regresar, se recupera lo que ya se había armado.
  const lastLook = useRef<Look | null>(value.look);
  // Lo que tenía puesto al abrir el editor: fuera del probador se sigue ofreciendo aunque se lo saque.
  const [worn] = useState<Look | null>(value.look);

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
        <LookEditor look={value.look!} worn={worn} avatar={value.avatar} wardrobe={wardrobe} onChange={setLook} />
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
      className="cozy-btn px-4 py-2"
    >
      {children}
    </button>
  );
}

/** Los seis personajes fijos, parados sobre un tile de pasto. */
function PresetGrid({ selected, onSelect }: { selected: HumanAvatar; onSelect: (a: HumanAvatar) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-[18px]">
      {HUMAN_AVATARS.map((a) => {
        const isSelected = a === selected;
        return (
          <button
            key={a}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(a)}
            className="cozy-btn flex aspect-[1/1.1] flex-col gap-0 overflow-hidden p-1"
          >
            <span className="relative grid w-full flex-1 place-items-center bg-[#5d9c46]">
              <span className="absolute bottom-[18%] h-[10%] w-[40%] rounded-[50%] bg-[#2f6036]" />
              <CharacterSprite avatar={a} dir="right" className="relative w-[62%]" />
            </span>
            <span className="w-full px-2 py-1.5 text-center text-[14px] capitalize">{a}</span>
          </button>
        );
      })}
    </div>
  );
}

/** El look con otro conjunto; sin conjunto se borra la clave (queda igual a un look de antes de la tienda). */
function withOutfit(look: Look, outfit: Outfit | undefined): Look {
  const { outfit: _, ...rest } = look;
  return outfit ? { ...rest, outfit } : rest;
}

function LookEditor({
  look,
  worn,
  avatar,
  wardrobe,
  onChange,
}: {
  look: Look;
  worn: Look | null;
  avatar: HumanAvatar;
  wardrobe: boolean;
  onChange: (l: Look) => void;
}) {
  const [dir, setDir] = useState<Direction>("down");
  // Fuera del probador se ofrece lo básico más lo que ya llevaba puesto (para sacárselo o volver a ponérselo).
  const hairStyles: readonly HairStyle[] = wardrobe
    ? HAIR_STYLES
    : HAIR_STYLES.filter((h) => BASIC_HAIR_STYLES.includes(h) || h === look.hairStyle || h === worn?.hairStyle);
  const accessories: readonly Accessory[] = wardrobe
    ? ACCESSORIES
    : ACCESSORIES.filter((a) => BASIC_ACCESSORIES.includes(a) || look.accessories.includes(a) || worn?.accessories.includes(a));
  const outfits: readonly Outfit[] = wardrobe ? OUTFITS : OUTFITS.filter((o) => o === look.outfit || o === worn?.outfit);
  const set = <K extends keyof Look>(key: K, v: Look[K]) => onChange({ ...look, [key]: v });
  // Solo un sombrero a la vez: al ponerse uno se saca el otro.
  const toggle = (a: Accessory) =>
    set(
      "accessories",
      look.accessories.includes(a)
        ? look.accessories.filter((x) => x !== a)
        : [...look.accessories.filter((x) => !(HEADWEAR.includes(a) && HEADWEAR.includes(x))), a],
    );
  // Lo que se pinta con el color de acento, para nombrarlo en el selector.
  const accentUsers = [...look.accessories.map((a) => ACCENT_ACCESSORIES[a]), look.outfit && ACCENT_OUTFITS[look.outfit]].filter(
    (n): n is string => Boolean(n),
  );

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      {/* Vista previa: el personaje caminando, con botones para girarlo. */}
      <div className="cozy-panel flex flex-col self-start p-2 max-sm:mx-auto max-sm:w-44 sm:sticky sm:top-4">
        <div className="relative grid aspect-square place-items-center bg-[#5d9c46]">
          <span className="absolute bottom-[16%] h-[9%] w-[34%] rounded-[50%] bg-[#2f6036]" />
          <CharacterSprite avatar={avatar} look={look} dir={dir} walking className="relative w-[70%]" />
        </div>
        <div className="flex items-center justify-between gap-2 px-1 pt-2 text-[14px] max-sm:justify-center">
          <span className="max-sm:hidden">Vista previa</span>
          <button type="button" onClick={() => setDir(TURN[(TURN.indexOf(dir) + 1) % TURN.length]!)} className="cozy-btn px-2.5 py-1 text-[13px]">
            Girar
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
                className="cozy-btn p-0.5"
              >
                <CharacterSprite avatar={a} dir="right" className="w-8" />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Piel">
          <Swatches colors={SKIN_TONES} value={look.skin} onChange={(v) => set("skin", v)} />
        </Field>

        <Field label="Peinado">
          <Chips
            options={hairStyles.map((h) => ({ id: h, label: HAIR_STYLE_LABEL[h] }))}
            isOn={(h) => h === look.hairStyle}
            onToggle={(h) => set("hairStyle", h)}
          />
        </Field>

        <Field label="Color de pelo">
          <Swatches colors={HAIR_COLORS} value={look.hair} onChange={(v) => set("hair", v)} />
        </Field>

        {outfits.length > 0 && (
          <Field label="Conjunto">
            <Chips
              options={[{ id: "none" as const, label: "Camisa y pantalón" }, ...outfits.map((o) => ({ id: o, label: OUTFIT_LABEL[o] }))]}
              isOn={(o) => (o === "none" ? !look.outfit : o === look.outfit)}
              onToggle={(o) => onChange(withOutfit(look, o === "none" || o === look.outfit ? undefined : o))}
            />
          </Field>
        )}

        {/* El vestido usa el color de la camisa y el overol el del pantalón. */}
        <Field label={look.outfit === "dress" ? "Vestido" : "Camisa"}>
          <Swatches colors={INK_COLORS} value={look.shirt} onChange={(v) => set("shirt", v)} />
        </Field>

        {look.outfit !== "dress" && (
          <Field label={look.outfit === "overalls" ? "Overol" : "Pantalón"}>
            <Swatches colors={INK_COLORS} value={look.pants} onChange={(v) => set("pants", v)} />
          </Field>
        )}

        <Field label="Accesorios">
          <Chips
            options={accessories.map((a) => ({ id: a, label: ACCESSORY_LABEL[a] }))}
            isOn={(a) => look.accessories.includes(a)}
            onToggle={toggle}
          />
        </Field>

        {accentUsers.length > 0 && (
          <Field label={`Color de ${joinEs(accentUsers)}`}>
            <Swatches colors={INK_COLORS} value={look.accent} onChange={(v) => set("accent", v)} />
          </Field>
        )}

        {!wardrobe && (
          <p className="cozy-chip flex items-center gap-2 self-start px-3 py-1.5 text-[13px] leading-snug text-cozy-ink-soft">
            <PixelIcon name="star" size={14} className="shrink-0" />
            Más peinados, accesorios y conjuntos en el probador de la tienda (planta baja).
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-semibold text-cozy-ink-soft">{label}</span>
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
            className="cozy-btn px-3 py-1 text-[13px]"
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
          className="h-7 w-7 border-2 border-cozy-frame"
          style={{
            background: c,
            outline: c.toLowerCase() === current ? "3px solid var(--color-cozy-red)" : "none",
            outlineOffset: 1,
          }}
        />
      ))}
      {/* overflow-hidden: el <input type="color"> nativo es más ancho que la casilla y en el celular movía el panel. */}
      <label
        title="Otro color"
        className="relative grid h-7 w-7 cursor-pointer place-items-center overflow-hidden border-2 border-dashed border-cozy-frame text-sm font-semibold"
        style={
          inPalette
            ? { background: "var(--color-cozy-paper-light)" }
            : { background: value, borderStyle: "solid", outline: "3px solid var(--color-cozy-red)", outlineOffset: 1 }
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
