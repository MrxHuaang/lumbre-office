import { describe, expect, it } from "vitest";
import { STAT_KEYS, achievementById } from "./achievements";
import { QUEST_GIVERS, questById, questGiverNpc } from "./encargos";
import {
  AURORA_WELCOME,
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
