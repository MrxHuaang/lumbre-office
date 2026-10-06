"use client";

// Contenido de las pestañas del editor de personaje. Se dibuja con el look "diferido" (ver LookEditor):
// al arrastrar un color, la vista previa responde al instante y las miniaturas se ponen al día después.
import { HIDES_BOTTOM } from "@hyvento/map/art";
import {
  BACK_ITEMS,
  BOTTOMS,
  COSTUME_CATEGORIES,
  COSTUME_IDS,
  lockedCostume,
  unlockText,
  COSTUMES,
  costumeTint,
  EVERYDAY_OUTFITS,
  EYE_STYLES,
  FACE_ITEMS,
  FACIAL_HAIR,
  HAIR_STYLES,
  HEAD_ITEMS,
  HUMAN_AVATARS,
  isSwimwear,
  NECK_ITEMS,
  PATTERNS,
  SHOES,
  SWIMWEAR,
  TOPS,
  type FullLook,
  type HumanAvatar,
  type CostumeId,
  type Look,
  type Outfit,
} from "@hyvento/shared";
import { memo } from "react";
import { useMyLevels } from "@/game/oficios";
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

export type TabId = "body" | "hair" | "costume" | "clothes" | "gear";
export type ColorKey = "skin" | "hair" | "eyeColor" | "shirt" | "top2" | "pants" | "shoeColor" | "accent" | "costumeColor";

/** Lo que se puede cambiar desde las pestañas (funciones estables: no hacen redibujar el panel). */
export interface LookActions {
  set: <K extends keyof FullLook>(key: K, v: FullLook[K]) => void;
  toggle: (key: "blush" | "freckles") => void;
  color: (key: ColorKey) => (hex: string) => void;
  preset: (avatar: HumanAvatar) => void;
  /** Ponerse un traje (con su color por defecto). */
  wear: (costume: CostumeId) => void;
}

const PANTS_TITLE = {
  pants: "Color del pantalón",
  shorts: "Color de los shorts",
  skirt: "Color de la falda",
  "long-skirt": "Color de la falda",
  cargo: "Color del pantalón",
  joggers: "Color del jogger",
} as const;
/** Título del color de abajo cuando lo lleva un conjunto. */
const PANTS_OUTFIT_TITLE: Partial<Record<Outfit, string>> = {
  overalls: "Color del overol",
  trunks: "Color de la pantaloneta",
  coveralls: "Color del enterizo",
  blazer: "Color del traje",
  vest: "Color del chaleco y el pantalón",
};
/** Título del color principal según lo que lo lleva. */
const SHIRT_TITLE: Partial<Record<Outfit, string>> = {
  dress: "Color del vestido",
  gown: "Color del vestido",
  swimsuit: "Color del traje de baño",
  bikini: "Color del bikini",
  coat: "Color del abrigo",
  raincoat: "Color del impermeable",
  pajamas: "Color del pijama",
  robe: "Color de la bata",
  ruana: "Color de la ruana",
};

export const LookPanel = memo(function LookPanel({ tab, full, act }: { tab: TabId; full: FullLook; act: LookActions }) {
  const levels = useMyLevels();
  // Las miniaturas muestran la opción sobre la ropa propia (sin el traje, que la taparía).
  const thumb = (patch: Partial<FullLook>): Look => lookFromFull({ ...full, costume: null, ...patch });
  const options = <T extends string>(ids: readonly T[], label: Record<T, string>, patch: (id: T) => Partial<FullLook>): Option<T>[] =>
    ids.map((id) => ({ id, label: label[id], look: thumb(patch(id)) }));
  const costume = full.costume ? COSTUMES[full.costume] : null;

  // El vestido (y lo que va en lugar de la ropa) tapa la parte de abajo.
  const dress = Boolean(full.outfit && HIDES_BOTTOM.has(full.outfit)) && !isSwimwear(full.outfit);
  // Con traje de baño no se ven la parte de arriba ni la de abajo; el bañador tampoco usa los colores de arriba.
  const swim = isSwimwear(full.outfit);
  const trunks = full.outfit === "trunks";
  // El entero y el bikini llevan el estampado: sus miniaturas lo muestran en el traje de baño.
  const patterned = swim && !trunks;
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
            <Section title="Barba y bigote" hint="Del color del pelo.">
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

      {tab === "costume" && (
        <>
          <Group>
            <Section title="Traje completo" hint="Te cambia toda la ropa de una vez. Los hay para cada rincón de la cabaña.">
              <OptionGrid
                crop="full"
                tall
                options={[{ id: "none" as const, label: "Sin traje", look: thumb({}) }]}
                isOn={() => !full.costume}
                onPick={() => act.set("costume", null)}
              />
            </Section>
          </Group>
          {COSTUME_CATEGORIES.map((cat) => (
            <Group key={cat.id}>
              <Section title={cat.label}>
                <OptionGrid
                  crop="full"
                  tall
                  options={COSTUME_IDS.filter((id) => COSTUMES[id].category === cat.id).map((id) => {
                    // Los de los oficios, con el nivel (lo valida también la web al guardar).
                    const lock = lockedCostume({ costume: id }, levels);
                    return {
                      id,
                      label: COSTUMES[id].label,
                      look: lookFromFull({ ...full, costume: id, costumeColor: null, costumeGear: true }),
                      locked: lock ? unlockText(lock) : undefined,
                    };
                  })}
                  isOn={(id) => id === full.costume}
                  onPick={(id: CostumeId) => act.wear(id)}
                />
              </Section>
            </Group>
          ))}
          {costume && (
            <Group>
              {costume.tint && (
                <Section title={costume.tint.label}>
                  <Swatches
                    label={costume.tint.label}
                    colors={INK_COLORS}
                    value={costumeTint(full.costume!, full.costumeColor) ?? INK_COLORS[0]!}
                    onChange={act.color("costumeColor")}
                  />
                </Section>
              )}
              <Section title="Sombrero y accesorios" hint="Los del traje, o los tuyos (se eligen en «Accesorios»).">
                <div role="group" aria-label="Sombrero y accesorios" className="flex flex-wrap gap-2">
                  {[
                    { on: true, label: "Los del traje" },
                    { on: false, label: "Los míos" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={full.costumeGear === o.on}
                      onClick={() => act.set("costumeGear", o.on)}
                      className="cozy-btn px-3 py-1.5 text-[14px]"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Section>
            </Group>
          )}
        </>
      )}

      {tab === "clothes" && (
        <>
          {costume && <CostumeNote name={costume.label} what="La ropa y sus colores los pone el traje" onRemove={() => act.set("costume", null)} />}
          <Group>
            <Section title="Parte de arriba" hint={swim ? "Con traje de baño no se ve." : undefined}>
              <OptionGrid
                crop="torso"
                disabled={swim}
                options={options(TOPS, TOP_LABEL, (top) => ({ top, outfit: null }))}
                isOn={(t) => t === full.top}
                onPick={(t) => act.set("top", t)}
              />
            </Section>
            <Section title="Estampado" hint={trunks ? "La pantaloneta no lleva." : undefined}>
              <OptionGrid
                crop="torso"
                disabled={trunks}
                options={options(PATTERNS, PATTERN_LABEL, (pattern) => ({ pattern, outfit: patterned ? full.outfit : null }))}
                isOn={(p) => p === full.pattern}
                onPick={(p) => act.set("pattern", p)}
              />
            </Section>
            {!trunks && (
              <>
                <Section title={(full.outfit && SHIRT_TITLE[full.outfit]) ?? "Color principal"}>
                  <Swatches label="Color principal" colors={INK_COLORS} value={full.shirt} onChange={act.color("shirt")} />
                </Section>
                <Section title={second.length ? colorTitle(second) : "Segundo color"} hint={second.length ? undefined : top2Hint(full)}>
                  <Swatches label="Segundo color" colors={INK_COLORS} value={full.top2} onChange={act.color("top2")} />
                </Section>
              </>
            )}
          </Group>
          <Group>
            <Section title="Parte de abajo" hint={dress ? "El vestido la tapa." : swim ? "Con traje de baño no se ve." : undefined}>
              <OptionGrid
                crop="legs"
                disabled={dress || swim}
                options={options(BOTTOMS, BOTTOM_LABEL, (bottom) => ({ bottom, outfit: null }))}
                isOn={(b) => b === full.bottom}
                onPick={(b) => act.set("bottom", b)}
              />
            </Section>
            {!dress && !patterned && (
              <Section title={(full.outfit && PANTS_OUTFIT_TITLE[full.outfit]) ?? PANTS_TITLE[full.bottom]}>
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
                  ...options(EVERYDAY_OUTFITS, OUTFIT_LABEL, (outfit) => ({ outfit })),
                ]}
                isOn={(o) => (o === "none" ? !full.outfit : o === full.outfit)}
                onPick={(o) => act.set("outfit", o === "none" ? null : (o as Outfit))}
              />
            </Section>
            <Section title="Traje de baño" hint="Va en lugar de la ropa.">
              <OptionGrid
                crop="body"
                options={options(SWIMWEAR, OUTFIT_LABEL, (outfit) => ({ outfit }))}
                isOn={(o) => o === full.outfit}
                onPick={(o) => act.set("outfit", o)}
              />
            </Section>
          </Group>
        </>
      )}

      {tab === "gear" && (
        <>
          {costume && full.costumeGear && (
            <CostumeNote name={costume.label} what="El sombrero y los accesorios son los del traje" onRemove={() => act.set("costumeGear", false)} removeLabel="Usar los míos" />
          )}
          <Group>
            <Section title="Cabeza">
              <OptionGrid
                crop="hat"
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

/** Aviso de que el traje tapa lo que se elige en esta pestaña, con un botón para quitárselo. */
function CostumeNote({ name, what, onRemove, removeLabel = "Quitar el traje" }: { name: string; what: string; onRemove: () => void; removeLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-2 border-dashed border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
      <p className="min-w-40 flex-1 text-[13px] leading-snug text-cozy-ink-soft">
        Llevas el traje de <strong className="font-semibold">{name}</strong>. {what}; si eliges algo aquí, te lo quitas.
      </p>
      <button type="button" onClick={onRemove} className="cozy-btn px-3 py-1.5 text-[13px]">
        {removeLabel}
      </button>
    </div>
  );
}
