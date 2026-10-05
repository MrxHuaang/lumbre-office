import { CINEMATICAS } from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import { usePrefsStore } from "../../lib/prefs";
import { cinePrefAllows, firstChoiceOf, playCinematic } from "./puerta";

const prologo = CINEMATICAS.prologo!;
const momento = CINEMATICAS.jackpot!;

describe("la puerta de las cinemáticas", () => {
  afterEach(() => usePrefsStore.setState({ cine: "todas", workMode: false }));

  it("las preferencias deciden qué se ve", () => {
    expect(cinePrefAllows(prologo)).toBe(true);
    expect(cinePrefAllows(momento)).toBe(true);
    usePrefsStore.setState({ workMode: true });
    expect([cinePrefAllows(prologo), cinePrefAllows(momento)]).toEqual([true, false]);
    usePrefsStore.setState({ workMode: false, cine: "historia" });
    expect([cinePrefAllows(prologo), cinePrefAllows(momento)]).toEqual([true, false]);
    usePrefsStore.setState({ cine: "ninguna" });
    expect([cinePrefAllows(prologo), cinePrefAllows(momento)]).toEqual([false, false]);
  });

  it("sin la escena lista no se ve y vale la primera opción", async () => {
    expect(firstChoiceOf(prologo)).toBe("si");
    expect(firstChoiceOf(momento)).toBeNull();
    await expect(playCinematic("prologo")).resolves.toBe("si");
    await expect(playCinematic("no-existe")).resolves.toBeNull();
  });
});
