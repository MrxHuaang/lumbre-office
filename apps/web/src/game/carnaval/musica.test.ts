import { CINE_MUSICA, CINE_SOUNDS, CINEMATICAS, COMPARSAS, CONJUNTO_DE, MURGAS, PIEZAS, REPERTORIO, repertorioDe } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { duracionDe, PAUSA_S, PIEZAS_MUSICA, sonandoEn } from "./musica-piezas";
import {
  CORCHEAS,
  RANGO,
  acorde,
  duracionS,
  leerNotas,
  midi,
  programaTramo,
  tramosDe,
  ventanaCorte,
  type Evento,
  type Instrumento,
} from "./musica-programa";

const MELODICOS = new Set<string>(Object.keys(RANGO));
const todos = (id: (typeof PIEZAS)[number]) => {
  const p = PIEZAS_MUSICA[id];
  return tramosDe(p).flatMap((_, i) => programaTramo(p, i).map((e) => ({ ...e, tramo: i })));
};

describe("la música del Carnaval", () => {
  it("cada pieza de la lista tiene su partitura, y cada compás de cada tema cierra", () => {
    expect(Object.keys(PIEZAS_MUSICA).sort()).toEqual([...PIEZAS].sort());
    for (const id of PIEZAS) {
      const p = PIEZAS_MUSICA[id];
      expect(p.conjunto, id).toBe(CONJUNTO_DE[id]);
      for (const [k, t] of Object.entries(p.temas)) {
        const { compases } = leerNotas(t.notas, CORCHEAS[p.metrica]); // tira si un compás no cierra
        const acordes = t.acordes.split(/\s+/);
        expect(acordes, `${id} ${k}`).toHaveLength(compases);
      }
      for (const t of p.forma) if (t.tema) expect(p.temas[t.tema], `${id} ${t.tema}`).toBeDefined();
    }
  });

  it("cada pieza dura de 2 a 3 minutos y cierra con su final", () => {
    for (const id of PIEZAS) {
      const d = duracionS(PIEZAS_MUSICA[id]);
      console.log(`${id}: ${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, "0")}`);
      expect(d, id).toBeGreaterThanOrEqual(120);
      expect(d, id).toBeLessThanOrEqual(185);
      expect(PIEZAS_MUSICA[id].forma.at(-1)?.final, id).toBe(true);
    }
  });

  it("el son sureño va en 6/8: el bombo en el 1 y el 4 y el guasá en cada corchea", () => {
    const sones = PIEZAS.filter((id) => id.startsWith("son-"));
    expect(sones.length).toBeGreaterThanOrEqual(2);
    for (const id of sones) {
      const p = PIEZAS_MUSICA[id];
      expect(p.metrica, id).toBe("6/8");
      expect(CORCHEAS[p.metrica]).toBe(6);
      const bombo = p.perc.bombo!.map(([x]) => x);
      expect(bombo, id).toContain(0);
      expect(bombo, id).toContain(3);
      expect(p.perc.guasa!.map(([x]) => x), id).toEqual([0, 1, 2, 3, 4, 5]);
      // En un compás pleno del programa también: el bombo cae en las corcheas 0 y 3 de cada compás.
      const ev = programaTramo(p, p.forma.findIndex((t) => t.tema === "A" && t.perc === "plena" && !t.cortes?.length));
      const enCompas = (inst: string) => new Set(ev.filter((e) => e.inst === inst).map((e) => e.at % 6));
      expect(enCompas("bombo").has(0) && enCompas("bombo").has(3), id).toBe(true);
      expect([...enCompas("guasa")].sort(), id).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it("hay murga y colectivo: un son sureño, un sanjuanito y La Guaneña de murga, y el sanjuanito y el bambuco del colectivo", () => {
    expect(REPERTORIO.murga).toEqual(expect.arrayContaining(["son-vereda", "sanjuanito-plaza", "guanena-murga"]));
    expect(REPERTORIO.colectivo).toEqual(expect.arrayContaining(["sanjuanito", "bambuco", "guanena"]));
    expect(PIEZAS_MUSICA["sanjuanito-plaza"].metrica).toBe("2/4");
    expect(PIEZAS_MUSICA.sanjuanito.metrica).toBe("2/4");
    expect(PIEZAS_MUSICA.bambuco.metrica).toBe("3/4");
    // Todo original salvo La Guaneña.
    for (const id of PIEZAS) expect(PIEZAS_MUSICA[id].original, id).toBe(!id.startsWith("guanena"));
  });

  it("cada instrumento toca en su registro", () => {
    for (const id of PIEZAS) {
      for (const e of todos(id)) {
        if (!MELODICOS.has(e.inst)) continue;
        const [lo, hi] = RANGO[e.inst as Instrumento];
        for (const m of e.ms ?? []) {
          expect(m, `${id} ${e.inst}`).toBeGreaterThanOrEqual(lo);
          expect(m, `${id} ${e.inst}`).toBeLessThanOrEqual(hi);
        }
      }
    }
    // Los temas, como están escritos, caben en quien los lleva casi siempre: la trompeta o la quena.
    for (const id of PIEZAS) {
      const p = PIEZAS_MUSICA[id];
      const [lo, hi] = RANGO[p.conjunto === "murga" ? "trompeta" : "quena"];
      for (const t of Object.values(p.temas))
        for (const n of leerNotas(t.notas, CORCHEAS[p.metrica]).notas)
          for (const m of n.ms) {
            expect(m, id).toBeGreaterThanOrEqual(lo);
            expect(m, id).toBeLessThanOrEqual(hi);
          }
    }
  });

  it("los instrumentos de cada conjunto: bronces y acordeón en la murga; quena, zampoña y rondador en el colectivo", () => {
    for (const id of PIEZAS) {
      const usados = new Set(todos(id).map((e) => e.inst));
      const quiere =
        CONJUNTO_DE[id] === "murga"
          ? ["trompeta", "saxo", "trombon", "acordeon", "bombo", "redoblante", "platillo", "timbal"]
          : ["quena", "zampona", "rondador", "bombo", "shekere"];
      for (const inst of quiere) expect(usados.has(inst as Evento["inst"]), `${id} ${inst}`).toBe(true);
      const ajenos = CONJUNTO_DE[id] === "murga" ? ["quena", "zampona", "rondador", "shekere"] : ["trompeta", "saxo", "trombon", "acordeon", "redoblante"];
      for (const inst of ajenos) expect(usados.has(inst as Evento["inst"]), `${id} ${inst}`).toBe(false);
      // La murga lleva también algo que raspa o sacude (güiro o guasá).
      if (CONJUNTO_DE[id] === "murga") expect(usados.has("guasa") || usados.has("guiro") || usados.has("guiroLargo"), id).toBe(true);
    }
  });

  it("toda pieza tiene percusión, y cada tramo que no es 'nada' también", () => {
    for (const id of PIEZAS) {
      const p = PIEZAS_MUSICA[id];
      p.forma.forEach((t, i) => {
        const perc = programaTramo(p, i).filter((e) => !MELODICOS.has(e.inst));
        if (t.perc === "nada") expect(perc, `${id} ${i}`).toHaveLength(0);
        else expect(perc.length, `${id} ${i}`).toBeGreaterThan(0);
      });
    }
  });

  it("en un corte de la murga nada suena entre el golpe y el repique, y cada pieza de murga tiene cortes", () => {
    for (const id of PIEZAS.filter((x) => CONJUNTO_DE[x] === "murga")) {
      const p = PIEZAS_MUSICA[id];
      const compas = CORCHEAS[p.metrica];
      const { golpe, repique } = ventanaCorte(compas);
      let cortes = 0;
      p.forma.forEach((t, i) => {
        const ev = programaTramo(p, i);
        for (const k of t.cortes ?? []) {
          cortes++;
          const a = k * compas + golpe;
          const b = k * compas + repique;
          // Lo que empieza en el silencio, y lo que viene de antes y se queda sonando.
          const suena = ev.filter((e) => (e.at >= a - 1e-6 && e.at < b) || (e.at < a && MELODICOS.has(e.inst) && e.at + e.dur > a + 1e-6));
          expect(suena, `${id} tramo ${i} compás ${k}`).toEqual([]);
          // El golpe es de todos: bombo y platillo.
          const golpeTodos = ev.filter((e) => Math.abs(e.at - k * compas) < 1e-6).map((e) => e.inst);
          expect(golpeTodos, `${id} ${i} ${k}`).toEqual(expect.arrayContaining(["bombo", "platillo"]));
        }
      });
      expect(cortes, id).toBeGreaterThanOrEqual(6);
    }
  });

  it("La Guaneña sigue la melodía de siempre, en Mi menor, con la dominante antes de volver", () => {
    const g = PIEZAS_MUSICA.guanena.temas.G!;
    const notas = leerNotas(g.notas, 6).notas.flatMap((n) => n.ms);
    // "do mi la la la la do' la sol sol sol sol, la sol mi la sol mi re do" (en Mi menor: la = Mi), tras el golpe del 1.
    const nombres = ["G4", "B4", "E5", "E5", "E5", "E5", "G5", "E5", "D5", "D5", "D5", "D5", "E5", "D5", "B4", "E5", "D5", "B4", "A4", "G4"];
    expect(notas.slice(1, 21)).toEqual(nombres.map(midi));
    expect(notas.at(-1)).toBe(midi("G4"));
    expect(g.acordes.split(" ").at(-1)).toBe("B7/Em");
    // La de la murga es la misma melodía.
    expect(PIEZAS_MUSICA["guanena-murga"].temas.G).toBe(g);
  });

  it("los acordes salen bien armados", () => {
    expect(acorde("Dm")).toEqual([midi("D4"), midi("F4"), midi("A4"), midi("D5")]);
    expect(acorde("A7")).toEqual([midi("A3"), midi("C#4"), midi("E4"), midi("G4")]);
    expect(acorde("Bb")).toEqual([midi("Bb3"), midi("D4"), midi("F4"), midi("Bb4")]);
  });

  it("no quedan referencias rotas: comparsas, murgas, repertorios y sonidos de las cinemáticas", () => {
    for (const c of COMPARSAS) expect(PIEZAS_MUSICA[c.pieza], c.id).toBeDefined();
    const ids = new Set(COMPARSAS.map((c) => c.id));
    for (const m of MURGAS) {
      expect(ids.has(m.tras), m.id).toBe(true);
      for (const p of m.repertorio) expect(CONJUNTO_DE[p], m.id).toBe("murga");
    }
    expect(new Set([...REPERTORIO.murga, ...REPERTORIO.colectivo])).toEqual(new Set(PIEZAS));
    for (const [sonido, pieza] of Object.entries(CINE_MUSICA)) {
      expect(CINE_SOUNDS as readonly string[], sonido).toContain(sonido);
      expect(PIEZAS_MUSICA[pieza]).toBeDefined();
    }
    // Las cinemáticas no piden sonidos que ya no existen (el albazo y el pasacalle se fueron).
    for (const c of Object.values(CINEMATICAS))
      for (const s of JSON.stringify(c.steps).matchAll(/"sound":"([^"]+)"/g)) expect(CINE_SOUNDS as readonly string[], c.id).toContain(s[1]);
    expect(CINE_SOUNDS as readonly string[]).not.toContain("albazo");
  });

  it("el repertorio de cada grupo rota y dos carrozas seguidas no empiezan con la misma pieza", () => {
    expect(repertorioDe("son-vereda")[0]).toBe("son-vereda");
    expect(new Set(repertorioDe("bambuco", 2))).toEqual(new Set(REPERTORIO.colectivo));
    const primeras = COMPARSAS.map((c, k) => repertorioDe(c.pieza, k + 1)[0]);
    for (let k = 1; k < primeras.length; k++)
      if (CONJUNTO_DE[COMPARSAS[k]!.pieza] === CONJUNTO_DE[COMPARSAS[k - 1]!.pieza] && COMPARSAS[k]!.pieza === COMPARSAS[k - 1]!.pieza)
        expect(primeras[k], COMPARSAS[k]!.id).not.toBe(primeras[k - 1]);
  });

  it("en el desfile cada grupo va por su repertorio: una pieza, la pausa y la siguiente", () => {
    const rep = REPERTORIO.murga;
    const d0 = duracionDe(rep[0]!);
    expect(sonandoEn(rep, 0)).toEqual({ pieza: rep[0], enS: 0, n: 0 });
    expect(sonandoEn(rep, 30_000)?.enS).toBeCloseTo(30);
    expect(sonandoEn(rep, (d0 + PAUSA_S / 2) * 1000)).toBeNull();
    const sig = sonandoEn(rep, (d0 + PAUSA_S + 1) * 1000);
    expect(sig?.pieza).toBe(rep[1]);
    expect(sig?.n).toBe(1);
    // Un desfile de 20 minutos no repite la misma pieza seguida en un grupo.
    let antes = "";
    for (let ms = 0; ms < 20 * 60_000; ms += 5000) {
      const s = sonandoEn(rep, ms);
      if (!s) continue;
      if (s.pieza !== antes && antes) expect(s.pieza).not.toBe(antes);
      antes = s.pieza;
    }
  });
});
