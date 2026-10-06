import { getWorld, pointsOfType, velitaBlock } from "@hyvento/map";
import { VELITAS_MSG } from "@hyvento/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOfficeStore, type PlayerInfo } from "./store";
import { useVelitasStore, velitasClick, velitasKey } from "./velitas";

const sent = vi.hoisted(() => [] as { type: string; msg: unknown }[]);
vi.mock("./network", () => ({ getRoom: () => ({ send: (type: string, msg: unknown) => sent.push({ type, msg }) }) }));

const jardin = getWorld().areas.get("jardin")!;
const TS = jardin.tileSize;
const spawn = pointsOfType(jardin, "spawn")[0]!;
const tip = pointsOfType(jardin, "fishing_spot").find((p) => p.name === "Muelle")!;
/** Un tile libre en la pradera con su vecino del este también libre. */
const free = (() => {
  for (let y = spawn.tileY - 6; y < spawn.tileY + 6; y++)
    for (let x = spawn.tileX - 8; x < spawn.tileX + 8; x++) if (!velitaBlock(jardin, x, y) && !velitaBlock(jardin, x + 1, y)) return { x, y };
  throw new Error("sin tile libre");
})();
const at = { x: (free.x + 0.5) * TS, y: (free.y + 0.5) * TS };

function hold(held: string, festival = { id: "velitas", fase: "fiesta" }) {
  useOfficeStore.setState({ sessionId: "s1", players: { s1: { sessionId: "s1", held } as unknown as PlayerInfo }, festival, panel: null });
}

beforeEach(() => {
  sent.length = 0;
  useVelitasStore.setState({ lit: 0, placed: [], wishes: [] });
});

describe("Noche de velitas en el navegador", () => {
  it("E con una velita en la mano la prende adelante; junto a otra cosa, E es para esa cosa", () => {
    hold("velita");
    expect(velitasKey(jardin, at, "right", "e", false)).toBe(true);
    expect(sent).toEqual([{ type: VELITAS_MSG.place, msg: { x: free.x + 1, y: free.y } }]);
    expect(velitasKey(jardin, at, "right", "e", true)).toBe(false);
    expect(velitasKey(jardin, at, "right", "f", true)).toBe(true);
  });

  it("si adelante ya hay una, va en los pies; sin el festival abierto no hace nada", () => {
    hold("velita");
    useVelitasStore.setState({ placed: [{ key: `${free.x + 1},${free.y}`, x: free.x + 1, y: free.y }] });
    velitasKey(jardin, at, "right", "e", false);
    expect(sent.at(-1)?.msg).toEqual({ x: free.x, y: free.y });
    hold("velita", { id: "velitas", fase: "fin" });
    expect(velitasKey(jardin, at, "right", "e", false)).toBe(false);
    hold("velita", { id: "brujas", fase: "fiesta" });
    expect(velitasKey(jardin, at, "right", "e", false)).toBe(false);
  });

  it("el clic prende una cerquita y camina si está lejos o no se puede", () => {
    hold("velita");
    expect(velitasClick(jardin, at, at.x + TS, at.y)).toBe(true);
    expect(velitasClick(jardin, at, at.x + 6 * TS, at.y)).toBe(false);
    expect(velitasClick(jardin, { x: spawn.x + TS, y: spawn.y }, spawn.x, spawn.y)).toBe(false);
    hold("tinto");
    expect(velitasClick(jardin, at, at.x + TS, at.y)).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it("el farol de deseos abre el deseo en el muelle; lejos, F avisa y E sigue de largo", () => {
    hold("farol-deseos");
    expect(velitasKey(jardin, { x: tip.x - 3 * TS, y: tip.y }, "right", "e", true)).toBe(true);
    expect(useOfficeStore.getState().panel?.kind).toBe("deseo");
    hold("farol-deseos");
    expect(velitasKey(jardin, at, "right", "e", false)).toBe(false);
    expect(velitasKey(jardin, at, "right", "f", false)).toBe(true);
    expect(useOfficeStore.getState().panel).toBeNull();
  });
});
