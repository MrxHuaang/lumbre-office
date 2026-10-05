import { describe, expect, it } from "vitest";
import { MAX_STATS, STAT_KEYS, achievementById } from "./achievements";
import { bagItemInfo, BAG_OBJECTS } from "./bolsa";
import { QUEST_GIVERS, questById, questGiverNpc } from "./encargos";
import {
  AURORA_WELCOME,
  CAPITULO_1,
  CAPITULOS,
  STORY_FLAGS,
  capituloOf,
  storyDiary,
  storyFlag,
  type Capitulo,
  LETTER_CH1,
  STORY_FIRST,
  STORY_LAST,
  STORY_LESSONS,
  STORY_QUESTS,
  STORY_TARGET,
  auroraIdleLine,
  isNewcomer,
  lettersFor,
  storyStepsDone,
} from "./historia";
import { HISTORIA_NPCS } from "./npcs";
import { GiftCreateBody, STORY_ITEM_GIFT_TEXT } from "./social";

describe("capítulo 1: La llegada", () => {
  it("son cinco pasos encadenados, todos de Doña Aurora, con su lección y su objetivo", () => {
    expect(STORY_QUESTS.map((q) => q.id)).toEqual(["llegada-1", "llegada-2", "llegada-3", "llegada-4", "llegada-5"]);
    expect(STORY_FIRST).toBe("llegada-1");
    expect(STORY_LAST).toBe("llegada-5");
    for (const [i, q] of STORY_QUESTS.entries()) {
      expect(q.kind).toBe("story");
      expect(q.giver).toBe("aurora");
      expect(q.next).toBe(STORY_QUESTS[i + 1]?.id);
      expect(STORY_LESSONS[q.id], q.id).toBeTruthy();
      expect(STORY_TARGET[q.id], q.id).toBeTruthy();
      // Está en el catálogo de los encargos (así la entrega es la de siempre).
      expect(questById(q.id)).toBe(q);
      // Pagan poquito (y aparte del tope de los diarios).
      expect(q.reward.points).toBeLessThanOrEqual(5);
    }
    expect(STORY_QUESTS.map((q) => q.stat)).toEqual(["order:tinto", STAT_KEYS.ownOfficeSits, STAT_KEYS.emotes, STAT_KEYS.fishCaught, STAT_KEYS.boardReads]);
  });

  it("Doña Aurora existe, vive en el recibidor lejos de la recepción y da los encargos de la historia", () => {
    const aurora = HISTORIA_NPCS.find((n) => n.id === "aurora")!;
    expect(aurora.area).toBe("planta-baja");
    expect(questGiverNpc("aurora")).toBe(aurora);
    expect(QUEST_GIVERS.aurora.name).toBe("Doña Aurora");
    expect(aurora.look.outfit).toBe("apron");
    // Doña Gloria (la recepción) atiende en el 14,20: Aurora queda en otro lado del recibidor.
    expect(aurora.tile).not.toEqual({ x: 14, y: 20 });
    expect(AURORA_WELCOME.length).toBeGreaterThan(0);
    expect(auroraIdleLine(3, "despejado", 1)).not.toBe(auroraIdleLine(3, "tormenta", 1));
  });

  it("quien ya jugaba tiene hechos los pasos cuyos contadores ya llegan", () => {
    expect(storyStepsDone({})).toEqual([]);
    expect(storyStepsDone({ "order:tinto": 3, [STAT_KEYS.fishCaught]: 40 })).toEqual(["llegada-1", "llegada-4"]);
  });

  it("la carta llega con el capítulo terminado; el prólogo es para quien entró hace menos de 3 días", () => {
    expect(lettersFor({})).toEqual([]);
    expect(lettersFor({ [STAT_KEYS.storyCh1]: 1 })).toEqual([LETTER_CH1]);
    expect(LETTER_CH1.from).toMatch(/^[A-ZÁÉÍÓÚÑ]\.$/);
    expect(achievementById("recien-llegado")?.stat).toBe(STAT_KEYS.storyCh1);
    const now = Date.UTC(2026, 8, 28);
    expect(isNewcomer(undefined, now)).toBe(false);
    expect(isNewcomer(now - 3600_000, now)).toBe(true);
    expect(isNewcomer(now - 4 * 86_400_000, now)).toBe(false);
  });
});

describe("el motor de la historia: capítulos", () => {
  const step = (id: string, next?: string) => ({ ...questById("llegada-5")!, id, ...(next ? { next } : { next: undefined }) });
  const letter = (id: string) => ({ id, from: "E.", title: id, body: id });
  const DOS: Capitulo = {
    id: "dos",
    n: 2,
    title: "Dos",
    summary: "Pasó lo dos.",
    steps: [step("dos-1", "dos-2"), step("dos-2", "dos-3"), step("dos-3")],
    lessons: { "dos-1": "a", "dos-2": "b", "dos-3": "c" },
    opensWith: CAPITULO_1.flag,
    flag: STAT_KEYS.storyCh2,
    letter: letter("carta-2"),
  };
  const TRES: Capitulo = { id: "tres", n: 3, title: "Tres", summary: "", steps: [step("tres-1")], lessons: {}, opensWith: STAT_KEYS.storyCh2, flag: STAT_KEYS.storyCh3 };
  const caps = [CAPITULO_1, DOS, TRES];

  it("el capítulo 1 es el primero, sin cambiar sus pasos, y cada capítulo está bien armado", () => {
    expect(CAPITULOS[0]).toBe(CAPITULO_1);
    expect(CAPITULO_1.steps.map((q) => q.id)).toEqual(["llegada-1", "llegada-2", "llegada-3", "llegada-4", "llegada-5"]);
    expect(CAPITULO_1.letter).toBe(LETTER_CH1);
    expect(STORY_FLAGS[0]).toBe(STAT_KEYS.storyCh1);
    for (const [i, c] of CAPITULOS.entries()) {
      expect(c.n, c.id).toBe(i + 1);
      expect(c.flag, c.id).toBe(storyFlag(c.n));
      // La bandera es de máximo (1 = terminado) y lo abre la del anterior (el primero, a todos).
      expect(MAX_STATS.has(c.flag), c.id).toBe(true);
      expect(c.opensWith, c.id).toBe(i === 0 ? undefined : CAPITULOS[i - 1]!.flag);
      expect(c.summary.length, c.id).toBeGreaterThan(10);
      for (const [j, q] of c.steps.entries()) {
        expect(q.kind, q.id).toBe("story");
        expect(questById(q.id), q.id).toBe(q);
        expect(capituloOf(q.id), q.id).toBe(c);
        expect(q.next, q.id).toBe(c.steps[j + 1]?.id);
        expect(c.lessons[q.id], q.id).toBeTruthy();
      }
      if (c.achievement) expect(achievementById(c.achievement)?.stat, c.id).toBe(c.flag);
      // Sus objetos están en la mochila como de historia.
      for (const id of Object.keys(c.items ?? {})) expect(BAG_OBJECTS[id]?.story, id).toBe(true);
    }
  });

  it("las cartas: las de todos los capítulos terminados, en orden", () => {
    expect(lettersFor({ [STAT_KEYS.storyCh2]: 1 }, caps)).toEqual([DOS.letter]);
    expect(lettersFor({ [STAT_KEYS.storyCh1]: 1, [STAT_KEYS.storyCh2]: 1, [STAT_KEYS.storyCh3]: 1 }, caps)).toEqual([LETTER_CH1, DOS.letter]);
  });

  it("el diario: terminados, el de ahora con sus pasos (sin spoilers) y los que faltan", () => {
    const flags = (f: Record<string, number>) => (k: string) => f[k];
    // Recién llega: el 1 es el de ahora, con su primer paso abierto y el resto escondido.
    const nuevo = storyDiary(flags({}), [{ questId: "llegada-1", status: "ACTIVE" }], caps);
    expect(nuevo.map((c) => c.state)).toEqual(["current", "locked", "locked"]);
    expect(nuevo[0]!.steps!.map((s) => s.state)).toEqual(["open", "hidden", "hidden", "hidden", "hidden"]);
    // A mitad del 2, con el paso cumplido por entregar.
    const medio = storyDiary(flags({ [STAT_KEYS.storyCh1]: 1 }), [{ questId: "dos-2", status: "DONE" }], caps);
    expect(medio.map((c) => c.state)).toEqual(["done", "current", "locked"]);
    expect(medio[1]!.steps!.map((s) => s.state)).toEqual(["done", "ready", "hidden"]);
    // Todos terminados.
    expect(storyDiary(flags({ [STAT_KEYS.storyCh1]: 1, [STAT_KEYS.storyCh2]: 1, [STAT_KEYS.storyCh3]: 1 }), [], caps).every((c) => c.state === "done")).toBe(true);
  });

  it("los objetos de historia no se regalan", () => {
    BAG_OBJECTS["llave-prueba"] = { name: "Llave de prueba", kind: "objeto", story: true };
    try {
      expect(bagItemInfo("obj:llave-prueba").story).toBe(true);
      expect(bagItemInfo("obj:tinto").story).toBe(false);
      const r = GiftCreateBody.safeParse({ toId: "u-bob", itemId: "obj:llave-prueba", quantity: 1 });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe(STORY_ITEM_GIFT_TEXT);
      expect(GiftCreateBody.safeParse({ toId: "u-bob", itemId: "obj:tinto", quantity: 1 }).success).toBe(true);
    } finally {
      delete BAG_OBJECTS["llave-prueba"];
    }
  });
});
