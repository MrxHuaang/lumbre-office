import { CINE_MUSICA, CINE_SOUNDS, CINEMATICAS, COMPARSAS, CONJUNTO_DE, MURGAS, PIEZAS, REPERTORIO, repertorioDe } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { duracionDe, PAUSA_S, PIEZAS_MUSICA, sonandoEn } from "./musica-piezas";
import {
  CORCHEAS,
  INSTRUMENTOS_DE,
  RANGO,
  acento,
  acorde,
  duracionS,
  humano,
  leerNotas,
  midi,
  programaTramo,
  segundaDe,
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

  it("cada pieza dura de 2 a 4 minutos y cierra con su final", () => {
    for (const id of PIEZAS) {
      const d = duracionS(PIEZAS_MUSICA[id]);
      console.log(`${id}: ${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, "0")}`);
      expect(d, id).toBeGreaterThanOrEqual(120);
      expect(d, id).toBeLessThanOrEqual(240);
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

  it("hay murga y colectivo, y La Guaneña (tradicional, con sus fuentes) en bambuco y en son sureño para cada uno", () => {
    expect(REPERTORIO.murga).toEqual(expect.arrayContaining(["son-vereda", "sanjuanito-plaza", "guanena-murga", "guanena-carnaval"]));
    expect(REPERTORIO.colectivo).toEqual(expect.arrayContaining(["sanjuanito", "bambuco", "guanena", "guanena-son"]));
    expect(PIEZAS_MUSICA["sanjuanito-plaza"].metrica).toBe("2/4");
    expect(PIEZAS_MUSICA.sanjuanito.metrica).toBe("2/4");
    expect(PIEZAS_MUSICA.bambuco.metrica).toBe("3/4");
    expect(PIEZAS_MUSICA["guanena-murga"].metrica).toBe("3/4");
    expect(PIEZAS_MUSICA.guanena.metrica).toBe("3/4");
    expect(PIEZAS_MUSICA["guanena-carnaval"].metrica).toBe("6/8");
    expect(PIEZAS_MUSICA["guanena-son"].metrica).toBe("6/8");
    // Todo original salvo La Guaneña, y lo tradicional dice de dónde sale (con enlace).
    for (const id of PIEZAS) {
      const p = PIEZAS_MUSICA[id];
      expect(p.original, id).toBe(!id.startsWith("guanena"));
      if (!p.original) {
        expect(p.fuentes?.length ?? 0, id).toBeGreaterThanOrEqual(2);
        for (const f of p.fuentes ?? []) expect(f.url, id).toMatch(/^https:\/\//);
      }
    }
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

  it("los instrumentos de cada conjunto: bronces, maderas, tuba y acordeón en la murga; vientos andinos y cuerdas en el colectivo", () => {
    for (const id of PIEZAS) {
      const usados = new Set(todos(id).map((e) => e.inst));
      const quiere =
        CONJUNTO_DE[id] === "murga"
          ? ["trompeta", "saxo", "trombon", "tuba", "acordeon", "bombo", "tambora", "redoblante", "platillo", "timbal"]
          : ["quena", "zampona", "rondador", "tiple", "guitarra", "bombo", "shekere", "maracas"];
      for (const inst of quiere) expect(usados.has(inst as Evento["inst"]), `${id} ${inst}`).toBe(true);
      // Nadie se cuela en el conjunto ajeno.
      for (const inst of usados) expect(INSTRUMENTOS_DE[CONJUNTO_DE[id]], `${id} ${inst}`).toContain(inst);
      // La murga lleva también algo que raspa o sacude (güiro o guasá).
      if (CONJUNTO_DE[id] === "murga") expect(usados.has("guasa") || usados.has("guiro") || usados.has("guiroLargo"), id).toBe(true);
    }
    // Entre todo el repertorio suenan todos los instrumentos de los dos conjuntos.
    const usados = new Set(PIEZAS.flatMap((id) => todos(id).map((e) => e.inst)));
    for (const inst of [...INSTRUMENTOS_DE.murga, ...INSTRUMENTOS_DE.colectivo]) expect(usados.has(inst), inst).toBe(true);
  });

  it("las cuerdas rasguean el acorde (el tiple con sus cuatro órdenes) y los bordones de la guitarra van abajo", () => {
    for (const id of PIEZAS.filter((x) => CONJUNTO_DE[x] === "colectivo")) {
      const ev = todos(id);
      const tiple = ev.filter((e) => e.inst === "tiple");
      expect(tiple.length, id).toBeGreaterThan(0);
      for (const e of tiple) {
        expect(e.rasgo === 1 || e.rasgo === -1, id).toBe(true);
        expect(e.ms, id).toHaveLength(4);
      }
      // Los bordones: una nota grave, en las cuerdas de abajo de la guitarra.
      const bordones = ev.filter((e) => e.inst === "guitarra" && !e.rasgo && e.ms!.length === 1 && e.ms![0]! < 52);
      expect(bordones.length, id).toBeGreaterThan(0);
    }
  });

  it("el contracanto se mueve por debajo de la melodía y el colchón sostiene el acorde", () => {
    const p = PIEZAS_MUSICA["guanena-murga"];
    const i = p.forma.findIndex((t) => t.contra === "trombon" && t.lleva === "saxo");
    const ev = programaTramo(p, i);
    // El trombón del contracanto (una nota; el del acompañamiento va de a dos).
    const contra = ev.filter((e) => e.inst === "trombon" && e.ms!.length === 1);
    expect(contra.length).toBeGreaterThan(10);
    expect(new Set(contra.map((e) => e.ms![0])).size).toBeGreaterThan(2);
    const j = p.forma.findIndex((t) => t.colchon === "acordeon");
    const colchon = programaTramo(p, j).filter((e) => e.inst === "acordeon" && e.dur >= CORCHEAS[p.metrica] / 2);
    expect(colchon.length).toBeGreaterThan(0);
    for (const e of colchon) expect(e.ms).toHaveLength(2);
  });

  it("la segunda voz va en terceras, sextas o cuartas; la dinámica crece donde dice y los acentos caen donde deben", () => {
    const em = acorde("Em");
    expect(segundaDe(midi("G5"), em)).toBe(midi("E5")); // una tercera abajo
    expect(segundaDe(midi("E5"), em, "sextas")).toBe(midi("G4")); // una sexta abajo
    expect(segundaDe(midi("E5"), em, "cuartas")).toBe(midi("B4")); // una cuarta abajo
    // El crescendo: el bombo del final del tramo suena más fuerte que el del comienzo.
    const p = PIEZAS_MUSICA["guanena-murga"];
    const i = p.forma.findIndex((t) => t.din && t.din[1] > t.din[0]);
    const bombos = programaTramo(p, i).filter((e) => e.inst === "bombo" && e.at % CORCHEAS[p.metrica] === 0);
    expect(bombos.at(-2)!.vol).toBeGreaterThan(bombos[1]!.vol);
    // El 1 manda, y en 6/8 también el 4.
    expect(acento("6/8", 0)).toBeGreaterThan(acento("6/8", 3));
    expect(acento("6/8", 3)).toBeGreaterThan(acento("6/8", 1));
    expect(acento("2/4", 0)).toBeGreaterThan(acento("2/4", 1));
  });

  it("la humanización es chiquita y siempre la misma para la misma nota", () => {
    for (let k = 0; k < 500; k++) {
      const h = humano(k);
      expect(Math.abs(h.dt)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(h.dv - 1)).toBeLessThanOrEqual(0.08);
      expect(humano(k)).toEqual(h);
    }
    expect(new Set(Array.from({ length: 50 }, (_, k) => humano(k).dt.toFixed(4))).size).toBeGreaterThan(30);
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

  it("La Guaneña sigue la melodía tradicional (las tres frases del cancionero), en Mi menor, con la dominante antes de volver", () => {
    const g = PIEZAS_MUSICA.guanena.temas.G!;
    const notas = leerNotas(g.notas, 6).notas.flatMap((n) => n.ms);
    // En solfeo, con "la" como tónica: la = Mi5, do = Sol4, do' = Sol5, re = La4, mi = Si4 y sol = Re5.
    const SOLFEO: Record<string, string> = { do: "G4", re: "A4", mi: "B4", sol: "D5", la: "E5", "do'": "G5" };
    const frase = (s: string) => s.split(" ").map((x) => midi(SOLFEO[x]!));
    const frases = [
      "do mi la la la la do' la sol sol sol sol la sol mi la sol mi re do",
      "do mi mi re do mi la sol la sol mi la sol mi re do",
      "do mi la do' la sol la sol mi la sol mi re do",
    ].map(frase);
    // Tras el golpe del 1, las tres frases seguidas.
    expect(notas.slice(1)).toEqual(frases.flat());
    expect(notas.at(-1)).toBe(midi("G4"));
    expect(g.acordes.split(" ").at(-1)).toBe("B7/Em");
    // Todos los arreglos tocan la misma melodía (el mismo tema).
    for (const id of ["guanena-murga", "guanena-carnaval", "guanena-son"] as const) expect(PIEZAS_MUSICA[id].temas.G, id).toBe(g);
    // La variación conserva el esqueleto: la misma armonía y cada compás empieza en la misma nota que el tema.
    const v = PIEZAS_MUSICA.guanena.temas.V!;
    expect(v.acordes).toBe(g.acordes);
    const primeras = (t: string) => t.split("|").map((b) => b.trim().split(/\s+/)[0]!.split(":")[0]);
    expect(primeras(v.notas).slice(1)).toEqual(primeras(g.notas).slice(1));
    // La lenta es la primera frase al doble de lento; dos notas largas que cruzan la barra se parten en dos
    // (un "sol" y el "do" del final).
    const lenta = leerNotas(PIEZAS_MUSICA.guanena.temas.L!.notas, 6).notas.flatMap((n) => n.ms);
    const f1 = frases[0]!;
    expect(lenta).toEqual([...f1.slice(0, 9), midi("D5"), ...f1.slice(9), midi("G4")]);
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
      // El trozo de la cinemática sale de un tramo que existe.
      expect(PIEZAS_MUSICA[pieza].forma[PIEZAS_MUSICA[pieza].extracto ?? 0], pieza).toBeDefined();
    }
    // Las cinemáticas no piden sonidos que ya no existen (el albazo y el pasacalle se fueron).
    for (const c of Object.values(CINEMATICAS))
      for (const s of JSON.stringify(c.steps).matchAll(/"sound":"([^"]+)"/g)) expect(CINE_SOUNDS as readonly string[], c.id).toContain(s[1]);
    expect(CINE_SOUNDS as readonly string[]).not.toContain("albazo");
  });

  it("La Guaneña es la protagonista: en cada conjunto vuelve a sonar cada dos piezas como mucho", () => {
    for (const lista of Object.values(REPERTORIO)) {
      for (let k = 0; k < lista.length; k++) {
        const rot = repertorioDe(lista[0]!, k);
        // En cualquier punto del ciclo, entre esa pieza y las dos siguientes hay una Guaneña.
        for (let i = 0; i < rot.length; i++) expect([0, 1, 2].some((d) => rot[(i + d) % rot.length]!.startsWith("guanena")), rot.join()).toBe(true);
      }
    }
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
