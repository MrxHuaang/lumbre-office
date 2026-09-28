import { describe, expect, it } from "vitest";
import { COSTUME_CATEGORIES, COSTUME_IDS, COSTUMES, costumeTint, wornLook } from "./costumes";
import { Look, normalizeLook } from "./look";

const base = { skin: "#ffdbac", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#e0923e", hairStyle: "short" as const };

describe("trajes completos", () => {
  it("hay más de veinte, cada uno en un grupo de la grilla y con colores válidos", () => {
    expect(COSTUME_IDS.length).toBeGreaterThanOrEqual(20);
    const groups = new Set(COSTUME_CATEGORIES.map((c) => c.id));
    for (const id of COSTUME_IDS) {
      const c = COSTUMES[id];
      expect(groups.has(c.category), id).toBe(true);
      expect(c.label.length, id).toBeGreaterThan(1);
      for (const color of Object.values(c.colors)) expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      // El color que se deja cambiar existe entre los del traje.
      for (const slot of c.tint?.slots ?? []) expect(c.colors[slot], `${id}: ${slot}`).toBeDefined();
    }
    // Ningún grupo queda vacío.
    for (const g of groups) expect(COSTUME_IDS.some((id) => COSTUMES[id].category === g), g).toBe(true);
  });

  it("un look con traje se guarda y se lee; uno viejo sin traje sigue igual", () => {
    expect(Look.parse({ ...base, costume: "chef", costumeColor: "#4660a0", costumeGear: false })).toMatchObject({ costume: "chef", costumeGear: false });
    const old = normalizeLook(Look.parse({ ...base, accessories: ["cap"] }));
    expect(old).toMatchObject({ costume: null, costumeColor: null, costumeGear: true, head: "cap" });
    // Sin traje, lo que se ve es el look tal cual.
    const worn = wornLook(old);
    expect({ ...worn, gloves: undefined, details: undefined }).toEqual({ ...old, gloves: undefined, details: undefined });
    expect(worn.details).toEqual([]);
  });

  it("un traje que ya no existe (o un color roto) no invalida el look: se ignora", () => {
    const parsed = Look.safeParse({ ...base, costume: "traje-viejo", costumeColor: "rojo" });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.costume).toBeUndefined();
    expect(parsed.data?.costumeColor).toBeUndefined();
  });

  it("el traje reemplaza la ropa y sus colores; el cuerpo sigue siendo el de la persona", () => {
    const full = normalizeLook({ ...base, top: "polo", head: "crown", costume: "bombero" });
    const worn = wornLook(full);
    const c = COSTUMES.bombero;
    expect(worn).toMatchObject({ top: c.top, bottom: c.bottom, outfit: c.outfit, shoes: c.shoes, pants: c.colors.pants, head: "fire-helmet", back: "air-tank" });
    expect(worn.gloves).toBe(c.gloves);
    expect(worn.details).toEqual(c.details);
    expect(worn).toMatchObject({ skin: base.skin, hair: base.hair, hairStyle: base.hairStyle });
  });

  it("sin sombrero ni accesorios del traje quedan los propios; el color elegido va a donde dice el traje", () => {
    const own = wornLook(normalizeLook({ ...base, head: "crown", neck: "scarf", costume: "chef", costumeGear: false }));
    expect(own).toMatchObject({ head: "crown", neck: "scarf", outfit: "chef-coat" });
    const tinted = wornLook(normalizeLook({ ...base, costume: "pescador", costumeColor: "#c05a4a" }));
    expect(tinted.shirt).toBe("#c05a4a");
    expect(tinted.accent).toBe("#c05a4a");
    expect(costumeTint("pescador", null)).toBe(COSTUMES.pescador.colors.shirt);
    expect(costumeTint("astronauta", "#c05a4a")).toBeNull();
  });
});
