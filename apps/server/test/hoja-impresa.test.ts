// VIR-137: la hoja de la impresora lleva el título de la nota, pero solo para quien la escribió.
import { bagItemInfo, bagItemName, objItemId, printedSheetOf, sheetNoteIdOf, type BagView } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Bag } from "../src/rooms/bag";

const ANA_NOTE = "notaana0001";
const sheetOf = (noteId: string) => objItemId(printedSheetOf(noteId));

function bagFor(repo: MemoryRepository) {
  const views = new Map<string, BagView>();
  const bag = new Bag({
    repo: () => repo,
    onHeld: () => {},
    onBag: (userId, view) => views.set(userId, view),
    cooldownMs: () => 1000,
  });
  return { bag, last: (userId: string) => views.get(userId) };
}

function withAnaNote(opts: { trashed?: boolean } = {}) {
  const repo = new MemoryRepository();
  repo.notes.set("ana", [{ id: ANA_NOTE, title: "Plan del viernes", ...opts }]);
  return repo;
}

describe("hoja impresa: el título de la nota", () => {
  it("quien escribió la nota ve su título en la hoja", async () => {
    const repo = withAnaNote();
    await repo.addInventory("ana", sheetOf(ANA_NOTE), 1);
    const { bag, last } = bagFor(repo);
    await bag.load("ana");
    expect(last("ana")?.titles).toEqual({ [sheetOf(ANA_NOTE)]: "Plan del viernes" });
    expect(bagItemName(sheetOf(ANA_NOTE), last("ana")?.titles)).toBe("Plan del viernes");
  });

  it("en la mochila de otra persona (regalo, intercambio) la hoja es genérica", async () => {
    const repo = withAnaNote();
    await repo.addInventory("beto", sheetOf(ANA_NOTE), 1);
    const { bag, last } = bagFor(repo);
    await bag.load("beto");
    expect(last("beto")?.titles).toBeUndefined();
    expect(bagItemName(sheetOf(ANA_NOTE), last("beto")?.titles)).toBe("Hoja impresa");
  });

  it("si la nota se borró, la hoja queda genérica; en la papelera conserva el título", async () => {
    const borrada = new MemoryRepository();
    await borrada.addInventory("ana", sheetOf(ANA_NOTE), 1);
    const a = bagFor(borrada);
    await a.bag.load("ana");
    expect(bagItemName(sheetOf(ANA_NOTE), a.last("ana")?.titles)).toBe("Hoja impresa");

    const papelera = withAnaNote({ trashed: true });
    await papelera.addInventory("ana", sheetOf(ANA_NOTE), 1);
    const b = bagFor(papelera);
    await b.bag.load("ana");
    expect(bagItemName(sheetOf(ANA_NOTE), b.last("ana")?.titles)).toBe("Plan del viernes");
  });

  it("las hojas viejas (obj:hoja) siguen igual y no consultan notas", async () => {
    const repo = withAnaNote();
    await repo.addInventory("ana", "obj:hoja", 3);
    const { bag, last } = bagFor(repo);
    await bag.load("ana");
    expect(repo.noteTitleQueries).toBe(0);
    expect(last("ana")?.titles).toBeUndefined();
    expect(bagItemInfo("obj:hoja")).toMatchObject({ name: "Hoja impresa", art: "hoja", max: 20 });
  });

  it("los títulos de todas las hojas salen de una sola consulta", async () => {
    const repo = new MemoryRepository();
    const ids = ["notaana0001", "notaana0002", "notaana0003"];
    repo.notes.set("ana", ids.map((id, i) => ({ id, title: `Nota ${i + 1}` })));
    for (const id of ids) await repo.addInventory("ana", sheetOf(id), 1);
    const { bag, last } = bagFor(repo);
    await bag.load("ana");
    expect(repo.noteTitleQueries).toBe(1);
    expect(Object.values(last("ana")?.titles ?? {}).sort()).toEqual(["Nota 1", "Nota 2", "Nota 3"]);
  });

  it("la hoja de una nota se dibuja y se lleva como la hoja impresa", async () => {
    const repo = withAnaNote();
    const { bag, last } = bagFor(repo);
    await bag.load("ana");
    expect(await bag.add("ana", sheetOf(ANA_NOTE), 1, { pick: true, title: "Plan del viernes" })).toBe("ok");
    expect(bag.get("ana")).toEqual({ item: "hoja", left: [1] });
    expect(last("ana")?.titles).toEqual({ [sheetOf(ANA_NOTE)]: "Plan del viernes" });
    expect(bagItemInfo(sheetOf(ANA_NOTE))).toMatchObject({ name: "Hoja impresa", art: "hoja", max: 20, furniture: false });
  });

  it("solo un id de nota bien formado cuenta como hoja de nota", () => {
    expect(sheetNoteIdOf(printedSheetOf(ANA_NOTE))).toBe(ANA_NOTE);
    expect(sheetNoteIdOf("hoja")).toBeNull();
    expect(sheetNoteIdOf("hoja:")).toBeNull();
    expect(sheetNoteIdOf("hoja:NO-VALE")).toBeNull();
    expect(sheetNoteIdOf("tinto")).toBeNull();
  });
});
