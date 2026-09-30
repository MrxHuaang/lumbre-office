import { CASA_PROPIA, casaAreaOf } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { buildCasaPropia, levelMap, portalDestination } from "./casa-propia";
import { findPath, getWorld, isBlockedTile, portalAtTile, spawnPoint, zoneAt, type OfficeMap } from "./index";

const barrio = getWorld().areas.get(CASA_PROPIA.street)!;
const puerta = barrio.portals.find((p) => p.id === CASA_PROPIA.portal)!;
const center = (map: OfficeMap, t: number) => t * map.tileSize + map.tileSize / 2;

describe("barrio", () => {
  it("es un nivel del mundo con una sola puerta, delante de la fachada de tu casa", () => {
    expect(barrio.portals).toHaveLength(1);
    const tuya = barrio.furniture.find((f) => f.type === "casa-fachada-tuya")!;
    const t = puerta.tiles[0]!;
    expect(t.y).toBe(tuya.y + tuya.d);
    expect(t.x >= tuya.x && t.x < tuya.x + tuya.w).toBe(true);
    // Tres fachadas más, de adorno.
    expect(barrio.furniture.filter((f) => f.type.startsWith("casa-fachada-"))).toHaveLength(4);
  });

  it("se camina desde la vereda hasta la puerta", () => {
    const spawn = spawnPoint(barrio);
    expect(findPath(barrio, { x: spawn.tileX, y: spawn.tileY }, puerta.tiles[0]!)).not.toBeNull();
  });

  it("la puerta lleva a la casa de quien entra", () => {
    expect(portalDestination(puerta, "u-ana")).toBe(casaAreaOf("u-ana"));
    expect(portalDestination(puerta, "u-beto")).toBe(casaAreaOf("u-beto"));
    // Los demás portales no cambian según quién los cruza.
    const jardin = getWorld().areas.get("jardin")!;
    for (const p of jardin.portals) expect(portalDestination(p, "u-ana")).toBe(p.to.area);
  });
});

describe("casa de cada persona", () => {
  const casa = buildCasaPropia(casaAreaOf("u-ana"))!;

  it("no está en el mundo: se arma por persona, con ids propios", () => {
    expect([...getWorld().areas.keys()].some((id) => id.startsWith(CASA_PROPIA.prefix))).toBe(false);
    const otra = buildCasaPropia(casaAreaOf("u-beto"))!;
    expect(casa.id).toBe("casa:u-ana");
    expect(otra.id).toBe("casa:u-beto");
    expect(casa.zones.map((z) => z.id)).toEqual(["casa:u-ana"]);
    expect(otra.zones.map((z) => z.id)).toEqual(["casa:u-beto"]);
  });

  it("solo se arman casas de alguien (ni el destino de la puerta ni los niveles de la cabaña)", () => {
    expect(buildCasaPropia(CASA_PROPIA.own)).toBeUndefined();
    expect(buildCasaPropia("jardin")).toBeUndefined();
    expect(buildCasaPropia("casa-arbol")).toBeUndefined();
  });

  it("se entra frente a la puerta, en una sala aislada, y se sale a la calle frente a tu fachada", () => {
    expect(isBlockedTile(casa, puerta.to.x, puerta.to.y)).toBe(false);
    expect(portalAtTile(casa, puerta.to.x, puerta.to.y)).toBeUndefined();
    expect(zoneAt(casa, center(casa, puerta.to.x), center(casa, puerta.to.y))).toMatchObject({ id: casa.id, isolated: true });
    const salida = casa.portals[0]!;
    expect(salida.to.area).toBe(CASA_PROPIA.street);
    expect(findPath(casa, { x: puerta.to.x, y: puerta.to.y }, salida.tiles[0]!)).not.toBeNull();
    // Se llega un paso delante de la puerta de la calle (no encima: si no, se volvería a entrar).
    expect(portalAtTile(barrio, salida.to.x, salida.to.y)).toBeUndefined();
    expect(Math.abs(salida.to.x - puerta.tiles[0]!.x) + Math.abs(salida.to.y - puerta.tiles[0]!.y)).toBe(1);
  });

  it("trae cama y cocinita, y deja espacio libre para decorar", () => {
    const types = casa.furniture.map((f) => f.type);
    expect(types).toEqual(expect.arrayContaining(["casa-cama", "stove", "kitchen-counter", "kitchen-sink"]));
    let free = 0;
    for (let y = 0; y < casa.height - 1; y++) for (let x = 0; x < casa.width; x++) if (!isBlockedTile(casa, x, y)) free++;
    expect(free).toBeGreaterThanOrEqual(20);
  });

  it("levelMap da los niveles de la cabaña y arma (y guarda) las casas", () => {
    const areas = new Map(getWorld().areas);
    expect(levelMap(areas, "jardin")).toBe(getWorld().areas.get("jardin"));
    const a = levelMap(areas, casaAreaOf("u-ana"))!;
    expect(a.id).toBe("casa:u-ana");
    expect(levelMap(areas, casaAreaOf("u-ana"))).toBe(a);
    expect(levelMap(areas, "no-existe")).toBeUndefined();
    // El mundo compartido no se toca.
    expect(getWorld().areas.has("casa:u-ana")).toBe(false);
  });
});
