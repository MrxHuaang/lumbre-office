import { describe, expect, it } from "vitest";
import { cleanDoorNote, DOOR_NOTES, DoorNoteMessage, doorNotesLeft, doorPostIts } from "./door-notes";

describe("notas en la puerta", () => {
  it("limpia espacios, renglones vacíos de sobra y corta al largo máximo", () => {
    expect(cleanDoorNote("   hola   mundo  ")).toBe("hola mundo");
    expect(cleanDoorNote("uno\r\n\r\n\r\n\r\ndos\t  tres")).toBe("uno\n\ndos tres");
    expect(cleanDoorNote(" \n \n ")).toBe("");
    const long = cleanDoorNote("a".repeat(DOOR_NOTES.maxLength + 50));
    expect(long).toHaveLength(DOOR_NOTES.maxLength);
  });

  it("el mensaje exige oficina y rechaza textos enormes", () => {
    expect(DoorNoteMessage.safeParse({ zoneId: "office-1", text: "Pasé a saludar" }).success).toBe(true);
    expect(DoorNoteMessage.safeParse({ zoneId: "", text: "x" }).success).toBe(false);
    expect(DoorNoteMessage.safeParse({ zoneId: "office-1", text: "x".repeat(DOOR_NOTES.maxLength * 2 + 1) }).success).toBe(false);
  });

  it("cuenta las que quedan hoy y los post-its de la puerta (0 a 3)", () => {
    expect(doorNotesLeft(0)).toBe(DOOR_NOTES.perDay);
    expect(doorNotesLeft(DOOR_NOTES.perDay + 4)).toBe(0);
    expect([0, 1, 2, 3, 7].map(doorPostIts)).toEqual([0, 1, 2, 3, 3]);
  });
});
