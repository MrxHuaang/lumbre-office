// La ahuyama del concurso de la más grande (la Feria de la cosecha, cosecha.ts). Su peso sale de cómo se
// cuidó en el huerto: el servidor lo calcula al cosecharla, con lo que ya guarda la parcela (cuándo se
// sembró y cuándo quedó lista: regada y en su temporada crece más rápido, y eso es lo que pesa), más un
// pellizco de suerte con la semilla de quien la sembró. No tiene tabla: el peso va en el id del objeto de la
// mochila (`obj:ahuyama:<decagramos>`), como la silleta, así la báscula lo lee de la mochila del servidor y
// nadie lo puede inventar. Este archivo no importa la mochila (bolsa.ts lo usa para nombrar el objeto).

export const AHUYAMA = {
  /** El cultivo y lo que se cosecha (en `CROPS`). */
  crop: "ahuyama",
  prefix: "ahuyama:",
  /** Lo más liviana y lo más pesada que sale (decagramos: 742 = 7,42 kg). */
  minDag: 150,
  maxDag: 1250,
  /** Las que se llevan a la vez (cada peso es su propia pila). */
  stackMax: 5,
} as const;

/** El id (sin `obj:`) de una ahuyama de ese peso. */
export const ahuyamaId = (dag: number) => `${AHUYAMA.prefix}${Math.round(dag)}`;

/** El peso (decagramos) de una ahuyama pesada (`ahuyama:<dag>`, con o sin `obj:`), o null si no es una. */
export function ahuyamaDagOf(id: string): number | null {
  const bare = id.startsWith("obj:") ? id.slice(4) : id;
  if (!bare.startsWith(AHUYAMA.prefix)) return null;
  const rest = bare.slice(AHUYAMA.prefix.length);
  if (!/^\d{1,5}$/.test(rest)) return null;
  const dag = Number(rest);
  return dag >= AHUYAMA.minDag && dag <= AHUYAMA.maxDag ? dag : null;
}

/** "7,42 kg". */
export const pesoTexto = (dag: number) => `${(dag / 100).toFixed(2).replace(".", ",")} kg`;

/** Un número de 0 a 1 que sale siempre igual de un texto (la suerte de cada mata). */
function suerte(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Qué tan bien se cuidó (0 a 1): lo rápido que creció comparado con lo que tarda en tierra húmeda. Regada
 * todo el tiempo y en otoño (su temporada) crece más rápido que eso; seca, cuatro veces más lento.
 */
export function cuidadoAhuyama(p: { growMs: number; plantedAt: number; readyAt: number }): number {
  const took = Math.max(1, p.readyAt - p.plantedAt);
  const speed = p.growMs / took;
  // De la mata olvidada (seca y fuera de temporada) a la consentida (regada y en otoño).
  return Math.max(0, Math.min(1, (speed - 0.25) / (1.4 - 0.25)));
}

/**
 * El peso (decagramos) de una ahuyama recién cosechada: el cuidado pone casi todo (de 2 a 9 kg) y la suerte
 * de la mata, con la semilla de quien la sembró y cuándo, hasta 2,5 kg más. Siempre lo mismo para la
 * misma parcela: lo calcula el servidor al cosecharla.
 */
export function pesoAhuyama(p: { growMs: number; plantedAt: number; readyAt: number; plantedBy: string }): number {
  const kg = 2 + 7 * cuidadoAhuyama(p) + 2.5 * suerte(`${p.plantedBy}:${p.plantedAt}`);
  return Math.max(AHUYAMA.minDag, Math.min(AHUYAMA.maxDag, Math.round(kg * 100)));
}

/** El nombre de una ahuyama pesada. */
export const ahuyamaName = (dag: number) => `Ahuyama de ${pesoTexto(dag)}`;

/** Para el dibujo: chica, mediana o grande según el peso. */
export const ahuyamaTalla = (dag: number): 0 | 1 | 2 => (dag < 500 ? 0 : dag < 850 ? 1 : 2);
