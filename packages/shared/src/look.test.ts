import { describe, expect, it } from "vitest";
import { LOOK_DEFAULTS, Look, normalizeLook } from "./look";

const base = { skin: "#ffdbac", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#e0923e" };

describe("normalizeLook", () => {
  it("un look viejo (con `accessories`) se traduce a los lugares nuevos", () => {
    const old = Look.parse({ ...base, hairStyle: "bun", accessories: ["glasses", "beard", "cap", "scarf"] });
    const full = normalizeLook(old);
    expect(full).toMatchObject({ face: "glasses", facialHair: "beard", head: "cap", neck: "scarf", back: "none" });
    expect(full).toMatchObject({ eyes: LOOK_DEFAULTS.eyes, top: "tshirt", bottom: "pants", shoes: "sneakers", blush: true });
  });

  it("lo elegido en un lugar gana sobre el formato viejo", () => {
    const full = normalizeLook({ ...base, hairStyle: "short", accessories: ["cap"], head: "crown", face: "none" });
    expect(full.head).toBe("crown");
    expect(full.face).toBe("none");
  });

  it("sirve con lo mínimo (personajes fijos) y el color secundario sigue al acento", () => {
    const full = normalizeLook({ skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653" });
    expect(full.hairStyle).toBe("short");
    expect(full.top2).toBe(full.accent);
    expect(Look.safeParse({ ...base, hairStyle: "mohawk", top: "hoodie", pattern: "stripes", head: "bow" }).success).toBe(true);
    expect(Look.safeParse({ ...base, hairStyle: "mohawk", top: "armadura" }).success).toBe(false);
  });
});
