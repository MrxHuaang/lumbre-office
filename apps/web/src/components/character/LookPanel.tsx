"use client";

// Contenido de las pestañas del editor de personaje. Se dibuja con el look "diferido" (ver LookEditor):
// al arrastrar un color, la vista previa responde al instante y las miniaturas se ponen al día después.
import {
  BACK_ITEMS,
  BOTTOMS,
  EYE_STYLES,
  FACE_ITEMS,
  FACIAL_HAIR,
  HAIR_STYLES,
  HEAD_ITEMS,
  HUMAN_AVATARS,
  NECK_ITEMS,
  OUTFITS,
  PATTERNS,
  SHOES,
  TOPS,
  type FullLook,
  type HumanAvatar,
  type Look,
  type Outfit,
} from "@hyvento/shared";
import { memo } from "react";
import {
  ACCENT_HINT,
  accentUsers,
  BACK_LABEL,
  BOTTOM_LABEL,
  colorTitle,
  EYE_COLORS,
  eyeColorHint,
  EYE_LABEL,
  FACE_LABEL,
  FACIAL_HAIR_LABEL,
  HAIR_COLORS,
  HAIR_STYLE_LABEL,
  HEAD_LABEL,
  INK_COLORS,
  lookFromFull,
  NECK_LABEL,
  OUTFIT_LABEL,
  PANTS_COLORS,
  PATTERN_LABEL,
  SHOE_COLORS,
  SHOES_LABEL,
  SKIN_TONES,
  top2Hint,
  top2Users,
  TOP_LABEL,
} from "@/lib/look-palette";
import { CharacterSprite } from "../CharacterSprite";
import { Group, OptionGrid, Section, Swatches, type Option } from "./controls";

export type TabId = "body" | "hair" | "clothes" | "gear";
export type ColorKey = "skin" | "hair" | "eyeColor" | "shirt" | "top2" | "pants" | "shoeColor" | "accent";

/** Lo que se puede cambiar desde las pestañas (funciones estables: no hacen redibujar el panel). */
export interface LookActions {
  set: <K extends keyof FullLook>(key: K, v: FullLook[K]) => void;
  toggle: (key: "blush" | "freckles") => void;
  color: (key: ColorKey) => (hex: string) => void;
  preset: (avatar: HumanAvatar) => void;
}

const PANTS_TITLE = { pants: "Color del pantalón", shorts: "Color de los shorts", skirt: "Color de la falda" } as const;

export const LookPanel = memo(function LookPanel({ tab, full, act }: { tab: TabId; full: FullLook; act: LookActions }) {
  const thumb = (patch: Partial<FullLook>): Look => lookFromFull({ ...full, ...patch });
  const options = <T extends string>(ids: readonly T[], label: Record<T, string>, patch: (id: T) => Partial<FullLook>): Option<T>[] =>
    ids.map((id) => ({ id, label: label[id], look: thumb(patch(id)) }));

  const dress = full.outfit === "dress";
  const accent = accentUsers(full);
  const second = top2Users(full);

  return (
    <>
      {tab === "body" && (
        <>
          <Group>
            <Section title="Partir de un personaje" hint="Vuelve a empezar desde uno de los fijos.">
              <div className="flex flex-wrap gap-1.5">
                {HUMAN_AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    title={`Partir de ${a}`}
                    aria-label={`Partir de ${a}`}
                    onClick={() => act.preset(a)}
                    className="cozy-btn p-0.5"
                  >
                    <CharacterSprite avatar={a} dir="right" className="w-9" />
                  </button>
                ))}
              </div>
            </Section>
          </Group>
          <Group>
            <Section title="Piel">
              <Swatches label="Color de piel" colors={SKIN_TONES} value={full.skin} onChange={act.color("skin")} />
            </Section>
          </Group>
          <Group>
            <Section title="Ojos">
              <OptionGrid
                crop="head"
                options={options(EYE_STYLES, EYE_LABEL, (eyes) => ({ eyes, face: "none" }))}
                isOn={(e) => e === full.eyes}
                onPick={(e) => act.set("eyes", e)}
              />
            </Section>
            <Section title="Color de ojos" hint={eyeColorHint(full)}>
              <Swatches label="Color de ojos" colors={EYE_COLORS} value={full.eyeColor} onChange={act.color("eyeColor")} />
            </Section>
          </Group>
          <Group>
            <Section title="Detalles" hint="Se prenden y se apagan.">
              <OptionGrid
                crop="head"
                options={[
                  { id: "blush", label: "Rubor", look: thumb({ blush: true, face: "none" }) },
                  { id: "freckles", label: "Pecas", look: thumb({ freckles: true, face: "none" }) },
                ]}
                isOn={(k) => full[k]}
                onPick={act.toggle}
              />
            </Section>
          </Group>
        </>
      )}

      {tab === "hair" && (
        <>
          <Group>
            <Section title="Peinado">
              <OptionGrid
                crop="head"
                options={options(HAIR_STYLES, HAIR_STYLE_LABEL, (hairStyle) => ({ hairStyle, head: "none" }))}
                isOn={(h) => h === full.hairStyle}
                onPick={(h) => act.set("hairStyle", h)}
              />
            </Section>
            <Section title="Color de pelo" hint="También el de la barba y el bigote.">
              <Swatches label="Color de pelo" colors={HAIR_COLORS} value={full.hair} onChange={act.color("hair")} />
            </Section>
          </Group>
          <Group>
            <Section title="Vello facial" hint="Del color del pelo.">
              <OptionGrid
                crop="head"
                options={options(FACIAL_HAIR, FACIAL_HAIR_LABEL, (facialHair) => ({ facialHair, face: "none" }))}
                isOn={(f) => f === full.facialHair}
                onPick={(f) => act.set("facialHair", f)}
              />
            </Section>
          </Group>
        </>
      )}

      {tab === "clothes" && (
        <>
          <Group>
            <Section title="Parte de arriba">
              <OptionGrid
                crop="torso"
                options={options(TOPS, TOP_LABEL, (top) => ({ top, outfit: null }))}
                isOn={(t) => t === full.top}
                onPick={(t) => act.set("top", t)}
              />
            </Section>
            <Section title="Estampado">
              <OptionGrid
                crop="torso"
                options={options(PATTERNS, PATTERN_LABEL, (pattern) => ({ pattern, outfit: null }))}
                isOn={(p) => p === full.pattern}
                onPick={(p) => act.set("pattern", p)}
              />
            </Section>
            <Section title={dress ? "Color del vestido" : "Color principal"}>
              <Swatches label="Color principal" colors={INK_COLORS} value={full.shirt} onChange={act.color("shirt")} />
            </Section>
            <Section title={second.length ? colorTitle(second) : "Segundo color"} hint={second.length ? undefined : top2Hint(full)}>
              <Swatches label="Segundo color" colors={INK_COLORS} value={full.top2} onChange={act.color("top2")} />
            </Section>
          </Group>
          <Group>
            <Section title="Parte de abajo" hint={dress ? "El vestido la tapa." : undefined}>
              <OptionGrid
                crop="legs"
                disabled={dress}
                options={options(BOTTOMS, BOTTOM_LABEL, (bottom) => ({ bottom, outfit: null }))}
                isOn={(b) => b === full.bottom}
                onPick={(b) => act.set("bottom", b)}
              />
            </Section>
            {!dress && (
              <Section title={full.outfit === "overalls" ? "Color del overol" : PANTS_TITLE[full.bottom]}>
                <Swatches label="Color de la parte de abajo" colors={PANTS_COLORS} value={full.pants} onChange={act.color("pants")} />
              </Section>
            )}
          </Group>
          <Group>
            <Section title="Zapatos">
              <OptionGrid
                crop="legs"
                options={options(SHOES, SHOES_LABEL, (shoes) => ({ shoes }))}
                isOn={(s) => s === full.shoes}
                onPick={(s) => act.set("shoes", s)}
              />
            </Section>
            <Section title="Color de zapatos">
              <Swatches label="Color de zapatos" colors={SHOE_COLORS} value={full.shoeColor} onChange={act.color("shoeColor")} />
            </Section>
          </Group>
          <Group>
            <Section title="Conjunto" hint="Va encima de la ropa.">
              <OptionGrid
                crop="body"
                options={[
                  { id: "none" as const, label: "Nada", look: thumb({ outfit: null }) },
                  ...options(OUTFITS, OUTFIT_LABEL, (outfit) => ({ outfit })),
                ]}
                isOn={(o) => (o === "none" ? !full.outfit : o === full.outfit)}
                onPick={(o) => act.set("outfit", o === "none" ? null : (o as Outfit))}
              />
            </Section>
          </Group>
        </>
      )}

      {tab === "gear" && (
        <>
          <Group>
            <Section title="Cabeza">
              <OptionGrid
                crop="head"
                options={options(HEAD_ITEMS, HEAD_LABEL, (head) => ({ head }))}
                isOn={(h) => h === full.head}
                onPick={(h) => act.set("head", h)}
              />
            </Section>
            <Section title="Cara">
              <OptionGrid
                crop="head"
                options={options(FACE_ITEMS, FACE_LABEL, (face) => ({ face }))}
                isOn={(f) => f === full.face}
                onPick={(f) => act.set("face", f)}
              />
            </Section>
            <Section title="Cuello">
              <OptionGrid
                crop="torso"
                options={options(NECK_ITEMS, NECK_LABEL, (neck) => ({ neck }))}
                isOn={(n) => n === full.neck}
                onPick={(n) => act.set("neck", n)}
              />
            </Section>
            <Section title="Espalda" hint="Se ve mejor de espaldas.">
              <OptionGrid
                crop="body"
                dir="up"
                options={options(BACK_ITEMS, BACK_LABEL, (back) => ({ back }))}
                isOn={(b) => b === full.back}
                onPick={(b) => act.set("back", b)}
              />
            </Section>
          </Group>
          <Group>
            <Section title={accent.length ? colorTitle(accent) : "Color de acento"} hint={accent.length ? undefined : ACCENT_HINT}>
              <Swatches label="Color de acento" colors={INK_COLORS} value={full.accent} onChange={act.color("accent")} />
            </Section>
          </Group>
        </>
      )}
    </>
  );
});
