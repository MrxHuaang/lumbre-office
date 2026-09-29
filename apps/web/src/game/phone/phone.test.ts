// Lógica pura del celular: escritura multi-toque, culebrita, tonos, calculadora y la hora de Bogotá.
import { describe, expect, it } from "vitest";
import { APP_ICONS, ICON_INK } from "./iconos";
import { calcBack, calcDigit, calcDot, calcEquals, calcNextOp, calcOp, emptyCalc } from "./calc";
import { alarmDue, bogotaTime, parseAlarmDigits, type Alarm } from "./hora";
import { PHONE_SNAKE, PhoneSnake } from "./snake";
import { noteFreq, parseVoice, RINGTONES, toneLength } from "./tonos";
import { append, backspace, CHAT_MAX, cycleMode, emptyT9, MULTITAP_MS, pressKey, settle, smsCounter, SMS_MAX, type T9State } from "./t9";

/** Aprieta una secuencia ("44 444": un espacio = esperar a que la letra quede escrita). */
function type(s: T9State, keys: string, start = 0): T9State {
  let t = start;
  for (const k of keys) {
    if (k === " ") {
      t += MULTITAP_MS;
      s = settle(s, t);
      continue;
    }
    s = pressKey(s, k, t);
    t += 100;
  }
  return settle(s);
}

describe("escritura multi-toque", () => {
  it("apretar varias veces la misma tecla cambia la letra", () => {
    expect(type(emptyT9("", "abc"), "44 444").text).toBe("hi");
  });

  it("otra tecla deja escrita la letra anterior sin esperar", () => {
    expect(type(emptyT9("", "abc"), "4666").text).toBe("go");
  });

  it("modo Abc: mayúscula al empezar y después de un punto", () => {
    const s = type(emptyT9(), "44 444 1 0 2");
    expect(s.text).toBe("Hi. A");
  });

  it("la ñ está en el 6 y las tildes al final de cada tecla", () => {
    expect(type(emptyT9("", "abc"), "6666").text).toBe("ñ");
    expect(type(emptyT9("", "abc"), "3333").text).toBe("é");
  });

  it("después de la última letra vuelve a la primera", () => {
    expect(type(emptyT9("", "abc"), "55555").text).toBe("j");
  });

  it("el 0 es espacio y el modo 123 escribe números", () => {
    expect(type(emptyT9("", "abc"), "20 2").text).toBe("a a");
    expect(type(emptyT9("", "123"), "3000").text).toBe("3000");
  });

  it("la letra a prueba queda escrita recién al segundo", () => {
    const s = pressKey(emptyT9("", "abc"), "2", 0);
    expect(settle(s, MULTITAP_MS - 1).pending).not.toBeNull();
    expect(settle(s, MULTITAP_MS).pending).toBeNull();
  });

  it("* cambia de modo y borrar quita la letra a prueba", () => {
    expect(cycleMode(emptyT9()).mode).toBe("abc");
    expect(cycleMode(emptyT9("", "123")).mode).toBe("Abc");
    const s = pressKey(emptyT9("ho", "abc"), "2", 0);
    expect(backspace(s)).toEqual({ text: "ho", mode: "abc", max: SMS_MAX, pending: null });
  });

  it("el contador va de a SMS y el chat deja hasta 500 letras", () => {
    expect(smsCounter(emptyT9())).toBe("160/1");
    expect(smsCounter(emptyT9("x".repeat(170), "abc", CHAT_MAX))).toBe("150/2");
    expect(append(emptyT9("x".repeat(CHAT_MAX), "abc", CHAT_MAX), "y").text.length).toBe(CHAT_MAX);
  });

  it("no pasa del largo máximo (160 por defecto, lo que cabía en un SMS)", () => {
    let s = emptyT9("x".repeat(SMS_MAX - 1), "abc");
    s = append(s, "y");
    s = append(s, "z");
    s = pressKey(s, "2", 0);
    expect(s.text.length).toBe(SMS_MAX);
    expect(s.text.endsWith("y")).toBe(true);
  });
});

/** Culebrita con comida en un lugar conocido: `rand` devuelve los valores en orden y después 0.99. */
function snakeWith(values: number[]) {
  let i = 0;
  return new PhoneSnake(PHONE_SNAKE.cols, PHONE_SNAKE.rows, () => values[i++] ?? 0.99);
}

describe("culebrita del celular", () => {
  it("avanza, come, crece y se acelera", () => {
    // Cabeza en (5, mitad) mirando a la derecha; comida justo adelante.
    const mid = Math.floor(PHONE_SNAKE.rows / 2);
    const s = snakeWith([6.5 / PHONE_SNAKE.cols, (mid + 0.5) / PHONE_SNAKE.rows]);
    expect(s.food).toEqual({ x: 6, y: mid });
    const before = s.stepMs;
    expect(s.step()).toBe("eat");
    expect(s.body.length).toBe(5);
    expect(s.score).toBe(1);
    expect(s.stepMs).toBeLessThan(before);
  });

  it("no da media vuelta sobre sí misma", () => {
    const s = snakeWith([]);
    s.turn("left");
    s.step();
    expect(s.dir).toBe("right");
  });

  it("chocar con el borde termina la partida", () => {
    const s = snakeWith([]);
    s.turn("up");
    let last = null;
    for (let i = 0; i < PHONE_SNAKE.rows && !s.over; i++) last = s.step();
    expect(last).toBe("die");
    expect(s.over).toBe(true);
    expect(s.step()).toBeNull();
  });

  it("chocar con la cola termina la partida", () => {
    const s = snakeWith([]);
    // Con la cola larga detrás, doblar tres veces seguidas choca con ella.
    const y = s.body[0]!.y;
    for (let i = 0; i < 4; i++) s.body.push({ x: 1 - i, y });
    s.turn("down");
    s.step();
    s.turn("left");
    s.step();
    s.turn("up");
    expect(s.step()).toBe("die");
  });
});

describe("tonos", () => {
  it("las notas tienen la frecuencia correcta", () => {
    expect(noteFreq("A4")).toBeCloseTo(440);
    expect(noteFreq("A5")).toBeCloseTo(880);
    expect(noteFreq("C4")).toBeCloseTo(261.63, 1);
    expect(noteFreq("C#4")).toBeCloseTo(noteFreq("Db4")!);
    expect(noteFreq("H2")).toBeNull();
  });

  it("las duraciones siguen el pulso (y el punto alarga la mitad)", () => {
    const notes = parseVoice("A4/4 R/8 C5/4.", 120);
    expect(notes.map((n) => n.dur)).toEqual([0.5, 0.25, 0.75]);
    expect(notes[2]!.start).toBeCloseTo(0.75);
    expect(notes[1]!.freq).toBe(0);
  });

  it("todos los tonos se entienden completos y son cortos", () => {
    for (const r of RINGTONES) {
      for (const voice of [r.melody, r.bass ?? ""]) {
        const tokens = voice.trim() ? voice.trim().split(/\s+/).length : 0;
        expect(parseVoice(voice, r.bpm).length, `${r.name}`).toBe(tokens);
      }
      expect(toneLength(r)).toBeGreaterThan(1);
      expect(toneLength(r)).toBeLessThan(10);
    }
  });

  it("el bajo no dura más que la melodía", () => {
    for (const r of RINGTONES.filter((t) => t.bass)) {
      const end = (v: string) => parseVoice(v, r.bpm).reduce((a, n) => Math.max(a, n.start + n.dur), 0);
      expect(end(r.bass!)).toBeLessThanOrEqual(end(r.melody) + 1e-9);
    }
  });
});

describe("calculadora", () => {
  const run = (...fs: ((s: ReturnType<typeof emptyCalc>) => ReturnType<typeof emptyCalc>)[]) => fs.reduce((s, f) => f(s), emptyCalc());

  it("suma, multiplica y encadena de izquierda a derecha", () => {
    const s = run((s) => calcDigit(s, "1"), (s) => calcDigit(s, "2"), (s) => calcOp(s, "+"), (s) => calcDigit(s, "3"), (s) => calcOp(s, "×"), (s) => calcDigit(s, "2"), calcEquals);
    expect(s.entry).toBe("30");
  });

  it("el * cambia de operación sin número nuevo", () => {
    const s = run((s) => calcDigit(s, "8"), calcNextOp, calcNextOp, (s) => calcDigit(s, "3"), calcEquals);
    expect(s.entry).toBe("5");
  });

  it("dividir por cero da error y el borrar limpia", () => {
    const s = run((s) => calcDigit(s, "4"), (s) => calcOp(s, "÷"), (s) => calcDigit(s, "0"), calcEquals);
    expect(s.error).toBe(true);
    expect(calcBack(s)).toEqual(emptyCalc());
  });

  it("decimales sin errores de coma flotante a la vista", () => {
    const s = run((s) => calcDot(s), (s) => calcDigit(s, "1"), (s) => calcOp(s, "+"), (s) => calcDot(s), (s) => calcDigit(s, "2"), calcEquals);
    expect(s.entry).toBe("0.3");
  });
});

describe("hora de Bogotá y alarma", () => {
  it("es UTC-5 todo el año", () => {
    const t = bogotaTime(Date.UTC(2026, 8, 28, 3, 15, 9)); // 28 sep 03:15 UTC = 27 sep 22:15 en Bogotá
    expect([t.h, t.m, t.s, t.day, t.month, t.weekday, t.dayKey]).toEqual([22, 15, 9, 27, "sep", "domingo", "2026-09-27"]);
  });

  it("la alarma suena una vez por día, hasta 2 minutos tarde", () => {
    const a: Alarm = { on: true, h: 7, m: 30, firedOn: "" };
    const at = (h: number, m: number) => bogotaTime(Date.UTC(2026, 8, 27, h + 5, m));
    expect(alarmDue(a, at(7, 29))).toBe(false);
    expect(alarmDue(a, at(7, 30))).toBe(true);
    expect(alarmDue(a, at(7, 32))).toBe(true);
    expect(alarmDue(a, at(7, 33))).toBe(false);
    expect(alarmDue({ ...a, firedOn: "2026-09-27" }, at(7, 30))).toBe(false);
    expect(alarmDue({ ...a, on: false }, at(7, 30))).toBe(false);
  });

  it("la hora de la alarma se escribe con cuatro números", () => {
    expect(parseAlarmDigits("0730")).toEqual({ h: 7, m: 30 });
    expect(parseAlarmDigits("2460")).toBeNull();
    expect(parseAlarmDigits("73")).toBeNull();
  });
});

describe("íconos del menú", () => {
  it("todos son de 12x12 y usan colores conocidos", () => {
    for (const [id, rows] of Object.entries(APP_ICONS)) {
      expect(rows.length, id).toBe(12);
      for (const row of rows) {
        expect(row.length, `${id}: ${row}`).toBe(12);
        for (const ch of row) expect(ch === "." || ch in ICON_INK, `${id}: ${ch}`).toBe(true);
      }
    }
  });
});
