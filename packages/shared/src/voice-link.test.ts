import { describe, expect, it } from "vitest";
import { HEARING_HYSTERESIS, type Positioned } from "./proximity";
import { VOICE_RADIUS } from "./protocol";
import {
  nextVoiceLink,
  VOICE_IDLE_GRACE_MS,
  VOICE_LINK_IDLE,
  VOICE_WAKE_MARGIN,
  voiceNearby,
  type VoiceLink,
} from "./voice-link";

const at = (x: number, y: number, zoneId: string | null = null, zoneIsolated = false, area = "jardin"): Positioned => ({
  area,
  x,
  y,
  zoneId,
  zoneIsolated,
});

describe("voiceNearby", () => {
  const wake = VOICE_RADIUS + VOICE_WAKE_MARGIN;

  it("sin nadie más no hace falta la sala", () => {
    expect(voiceNearby(at(0, 0), [], false)).toBe(false);
  });

  it("se conecta un poco antes de que la otra persona se oiga", () => {
    expect(voiceNearby(at(0, 0), [at(VOICE_RADIUS + 10, 0)], false)).toBe(true);
    expect(voiceNearby(at(0, 0), [at(wake, 0)], false)).toBe(true);
    expect(voiceNearby(at(0, 0), [at(wake + 1, 0)], false)).toBe(false);
  });

  it("con histéresis: quien ya estaba cerca cuenta hasta un poco más lejos", () => {
    const edge = at(wake + HEARING_HYSTERESIS / 2, 0);
    expect(voiceNearby(at(0, 0), [edge], false)).toBe(false);
    expect(voiceNearby(at(0, 0), [edge], true)).toBe(true);
    expect(voiceNearby(at(0, 0), [at(wake + HEARING_HYSTERESIS + 1, 0)], true)).toBe(false);
  });

  it("en otro nivel no cuenta aunque las coordenadas coincidan", () => {
    expect(voiceNearby(at(0, 0), [at(0, 0, null, false, "sotano")], false)).toBe(false);
  });

  it("en una zona aislada cuenta quien está adentro, y no quien está afuera pegado a la pared", () => {
    const me = at(0, 0, "oficina-1", true);
    expect(voiceNearby(me, [at(900, 0, "oficina-1", true)], false)).toBe(true);
    expect(voiceNearby(me, [at(10, 0, "pasillo")], false)).toBe(false);
  });
});

describe("nextVoiceLink", () => {
  it("se conecta apenas hace falta", () => {
    expect(nextVoiceLink(VOICE_LINK_IDLE, true, 1000)).toEqual({ linked: true, idleSince: null });
  });

  it("sin hacer falta y sin conexión, sigue igual", () => {
    expect(nextVoiceLink(VOICE_LINK_IDLE, false, 1000)).toBe(VOICE_LINK_IDLE);
  });

  it("se suelta recién después del margen sin nadie cerca", () => {
    let link: VoiceLink = { linked: true, idleSince: null };
    link = nextVoiceLink(link, false, 10_000);
    expect(link).toEqual({ linked: true, idleSince: 10_000 });
    link = nextVoiceLink(link, false, 10_000 + VOICE_IDLE_GRACE_MS - 1);
    expect(link.linked).toBe(true);
    link = nextVoiceLink(link, false, 10_000 + VOICE_IDLE_GRACE_MS);
    expect(link).toEqual(VOICE_LINK_IDLE);
  });

  it("si alguien vuelve antes del margen, el conteo se reinicia", () => {
    let link: VoiceLink = { linked: true, idleSince: 0 };
    link = nextVoiceLink(link, true, 30_000);
    expect(link).toEqual({ linked: true, idleSince: null });
    link = nextVoiceLink(link, false, 40_000);
    link = nextVoiceLink(link, false, 40_000 + VOICE_IDLE_GRACE_MS - 1);
    expect(link.linked).toBe(true);
  });

  it("no crea objetos nuevos si nada cambia (el que llama compara por referencia)", () => {
    const on: VoiceLink = { linked: true, idleSince: null };
    expect(nextVoiceLink(on, true, 5)).toBe(on);
    const waiting: VoiceLink = { linked: true, idleSince: 5 };
    expect(nextVoiceLink(waiting, false, 6)).toBe(waiting);
  });
});
