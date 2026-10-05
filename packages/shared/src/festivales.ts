// Los festivales del calendario del juego (docs/plan-festivales.md, VIR-156): fiestas colombianas puestas en
// el año de la cabaña (cuatro estaciones de 21 días del juego; un día del juego dura una hora real). Un
// festival dura uno o varios días del juego: abre a las 9:00 con su cinemática para todos, se vive todo el
// día (decoración, NPC que dicen otras cosas, tienda, minijuego, encargos) y cierra a las 22:00 con otra.
// Aquí solo los datos y las reglas puras: qué festival cae en una fecha, en qué fase va y cuáles vienen.
import type { CineDef } from "./cinematicas";
import type { Season } from "./estaciones";

export const FESTIVAL_IDS = ["amor-amistad", "feria-flores", "cometas", "carnaval", "cosecha", "brujas", "velitas", "novenas", "ano-viejo"] as const;
export type FestivalId = (typeof FESTIVAL_IDS)[number];

/** Horas del juego en que abre y cierra (la cinemática de apertura y la de cierre). */
export const FESTIVAL_HORAS = { apertura: 9, cierre: 22 } as const;

export interface FestivalDef {
  id: FestivalId;
  nombre: string;
  /** Una línea para el calendario y el aviso. */
  resumen: string;
  estacion: Season;
  /** Día de la estación en que empieza (1..21) y cuántos días dura. */
  dia: number;
  dias: number;
  /** Lo que dicen los NPC mientras dura (si no hay, lo de siempre). */
  frases: Partial<Record<string, readonly string[]>>;
  /** Color del letrero del festival en el HUD. */
  color: string;
}

export const FESTIVALES: readonly FestivalDef[] = [
  {
    id: "amor-amistad",
    nombre: "Amor y amistad",
    resumen: "Amigo secreto toda la semana: dulces anónimos al buzón y la revelación al final.",
    estacion: "primavera",
    dia: 7,
    dias: 1,
    color: "#d0547a",
    frases: {
      aurora: ["¿Ya sacó su amigo secreto? No me diga quién es, que yo soy una tumba.", "En mis tiempos uno mandaba cartas perfumadas. Ahora es puro chocolate."],
      gloria: ["Llegaron tres dulces para la misma persona. No diré quién. Bueno… sí.", "Amor y amistad: la fecha en que todo el mundo es querido."],
      evelio: ["A mi amigo secreto le voy a dar un bagre. Con moñito.", "¿Dulces? Un pescadito frito es más sincero."],
    },
  },
  {
    id: "feria-flores",
    nombre: "Feria de las flores",
    resumen: "Silletas con flores del huerto, votación del equipo y desfile de silleteros.",
    estacion: "primavera",
    dia: 15,
    dias: 1,
    color: "#e0a23a",
    frases: {
      aurora: ["Esta silleta la armo yo con las flores del huerto. Ni se le ocurra pisarlas.", "Silletero que se respete carga la silleta con la espalda derechita."],
      gloria: ["El jurado es todo el equipo: vote con el corazón, no con el estómago.", "¡Qué belleza de flores! El recibidor huele a jardín."],
      evelio: ["Yo traje una silleta de juncos del lago. Es arte moderno.", "Las flores bonitas, pero el pez del día también merece desfile."],
      astronoma: ["Hasta las estrellas se ven más coloridas en feria.", "Las flores se abren con el sol; nosotros, con el tinto."],
    },
  },
  {
    id: "cometas",
    nombre: "Festival de cometas",
    resumen: "Cometas que se arman y se elevan con el viento del jardín; gana la que más sube.",
    estacion: "verano",
    dia: 9,
    dias: 1,
    color: "#3a8ad0",
    frases: {
      aurora: ["Cuidado con los cables, mijo, que la cometa se enreda en todo.", "Con este viento hasta mi ropa del patio está volando."],
      evelio: ["El viento del lago es el mejor pa' las cometas. Y pa' perder el sombrero.", "Mi cometa tiene forma de bagre. Vuela regular."],
      astronoma: ["Hoy el cielo es de las cometas. Esta noche, de las estrellas.", "Una cometa bien alta casi toca una nube."],
    },
  },
  {
    id: "carnaval",
    nombre: "Carnaval",
    resumen: "Máscaras, desfile de comparsa por el jardín, maicena y serpentinas, y concurso de disfraces.",
    estacion: "verano",
    dia: 18,
    dias: 1,
    color: "#8a3ad0",
    frases: {
      aurora: ["¡Quien lo vive es quien lo goza! Pero no me eche maicena en el pelo.", "Saque el disfraz, que hoy nadie es quien parece."],
      gloria: ["Hoy la recepción atiende disfrazada. Diga la contraseña: ¡carnaval!", "La comparsa sale del portón. ¡Súmese!"],
      portero: ["Con máscara o sin máscara, aquí se entra bailando.", "Hoy el casino es comparsa."],
    },
  },
  {
    id: "cosecha",
    nombre: "Feria de la cosecha",
    resumen: "Lo mejor del huerto, la granja y el lago en exhibición, con premios por categoría.",
    estacion: "otono",
    dia: 10,
    dias: 1,
    color: "#b5652a",
    frases: {
      aurora: ["La mazorca más grande se lleva la cinta azul. Y mis respetos.", "Esto es lo que se gana uno sembrando con paciencia."],
      evelio: ["Categoría pez más grande: ya saben quién gana.", "El lago también cosecha, que no se les olvide."],
      gloria: ["Los jueces pasan a mediodía. Que todo brille.", "Hay queso, chorizo, arepas… esto es una feria de verdad."],
    },
  },
  {
    id: "brujas",
    nombre: "Noche de brujas",
    resumen: "Calabazas, niebla, disfraces, dulce o truco por las puertas y el laberinto de maíz.",
    estacion: "otono",
    dia: 21,
    dias: 1,
    color: "#e0752a",
    frases: {
      aurora: [
        "¿Sabe la leyenda del sótano? Dicen que en noche de brujas se oye un reloj… detrás de una puerta que no abre nadie.",
        "Dulce o truco, pero que el truco no sea en mi cocina.",
      ],
      gloria: ["Hoy toque las puertas de las oficinas: algunos dan dulces, otros dan sustos.", "Si ve un fantasma en el pasillo, es Toño con una sábana."],
      evelio: ["Esta noche pican peces raros. O eso cuenta la gente asustada.", "En el lago flota una calabaza. No sé de quién es."],
      portero: ["Hoy no se entra al casino sin disfraz. Bueno, sí. Pero da pena.", "¿Dulce o truco? Yo doy truco."],
    },
  },
  {
    id: "velitas",
    nombre: "Noche de velitas",
    resumen: "Velitas y faroles por toda la cabaña, faroles de deseos en el lago y la medianoche iluminada.",
    estacion: "invierno",
    dia: 7,
    dias: 1,
    color: "#e8c34a",
    frases: {
      aurora: ["Prenda su velita y pida un deseo, pero bajito, que si no no se cumple.", "Esta noche la cabaña parece un pesebre gigante."],
      gloria: ["Los faroles de papel se sueltan en el muelle. Uno por persona.", "Cuente las velitas del jardín: yo voy en ciento y pico."],
      astronoma: ["Con tanta velita casi no se ven las estrellas. Casi.", "Un deseo con farol sube más alto que uno sin farol."],
    },
  },
  {
    id: "novenas",
    nombre: "Novenas de aguinaldo",
    resumen: "Nueve noches del juego: pesebre que se arma entre todos, villancicos, natilla y buñuelos y aguinaldos.",
    estacion: "invierno",
    dia: 12,
    dias: 9,
    color: "#3a9a5a",
    frases: {
      aurora: ["La novena es a las ocho, y el que llegue tarde reza el doble.", "Natilla con buñuelos: lo único que me tiene en pie en diciembre."],
      gloria: ["Esta noche le toca la figura del burrito al pesebre.", "Pajita en boca: el que hable, pierde. Empezamos… ya."],
      evelio: ["Yo pongo el pescado pa' la cena de Navidad. Pregunten antes.", "Tutaina tuturumá… ¿cómo era que seguía?"],
    },
  },
  {
    id: "ano-viejo",
    nombre: "Año viejo",
    resumen: "Quema del muñeco de año viejo, uvas y maletas a la medianoche y el año nuevo de la cabaña.",
    estacion: "invierno",
    dia: 21,
    dias: 1,
    color: "#c0392b",
    frases: {
      aurora: ["Tenga listas las doce uvas. Y la maleta, que este año sí viajamos.", "Al muñeco de año viejo le pusimos la corbata del cuidador de antes. Ojalá no le importe."],
      gloria: ["A la medianoche, todos al jardín a quemar el año viejo.", "Calzones amarillos, ¿sí o qué?"],
      evelio: ["Año nuevo, caña nueva. O la misma, pero con ilusión.", "Yo le pido al año nuevo un pez dorado. Siempre se lo pido."],
    },
  },
];

export const festivalById = (id: string): FestivalDef | undefined => FESTIVALES.find((f) => f.id === id);

/** El festival que cae en ese día de esa estación (o null). */
export function festivalEn(estacion: Season, diaDeEstacion: number): FestivalDef | null {
  return FESTIVALES.find((f) => f.estacion === estacion && diaDeEstacion >= f.dia && diaDeEstacion < f.dia + f.dias) ?? null;
}

/**
 * En qué va el festival a esa hora del juego: antes de abrir (`previa`), abierto (`fiesta`) o ya cerrado
 * (`fin`). Los de varios días abren y cierran cada día.
 */
export type FestivalFase = "previa" | "fiesta" | "fin";
export function festivalFase(minuteOfDay: number): FestivalFase {
  const h = minuteOfDay / 60;
  if (h < FESTIVAL_HORAS.apertura) return "previa";
  if (h < FESTIVAL_HORAS.cierre) return "fiesta";
  return "fin";
}

/** Los festivales de una estación, en orden (para marcarlos en el calendario). */
export function festivalesDe(estacion: Season): FestivalDef[] {
  return FESTIVALES.filter((f) => f.estacion === estacion).sort((a, b) => a.dia - b.dia);
}

/** Lo que dice un NPC en el festival (la misma frase para todos en ese rato), o null si no tiene. */
export function festivalLine(f: FestivalDef, npc: string, seed: number): string | null {
  const lines = f.frases[npc];
  return lines?.length ? lines[Math.abs(seed) % lines.length]! : null;
}

// ---------- Mensajes ----------

export const FESTIVAL_MSG = {
  /** Servidor → clientes: que se vea la cinemática de un festival (apertura, cierre o llegada tarde). */
  cine: "festival:cine",
} as const;

export interface FestivalCineEvent {
  id: string;
}

// ---------- Las cinemáticas ----------

/** Id de la cinemática de apertura, cierre o llegada tarde de un festival. */
export const festivalCineId = (id: FestivalId, momento: "apertura" | "cierre" | "llegada") => `festival-${id}-${momento}`;

/**
 * Apertura: Aurora, Gloria y Evelio llegan corriendo desde tres lados, se arma la rumba alrededor de uno
 * (bailan todos, confeti) y anuncian el festival; luego cada uno se va por su lado.
 */
const open = (f: FestivalDef, lines: readonly [string, string], extra: CineDef["steps"] = []): CineDef => ({
  id: festivalCineId(f.id, "apertura"),
  kind: "momento",
  steps: [
    { op: "spawn", id: "aurora", like: "aurora", at: { dx: 6, dy: 1 }, facing: "left" },
    { op: "spawn", id: "gloria", like: "gloria", at: { dx: -6, dy: 1 }, facing: "right" },
    { op: "spawn", id: "evelio", like: "evelio", at: { dx: 1, dy: 6 }, facing: "up" },
    { op: "sound", sound: "tambor" },
    {
      op: "together",
      steps: [
        { op: "walk", who: "aurora", run: true, to: { dx: 2, dy: 1 } },
        { op: "walk", who: "gloria", run: true, to: { dx: -2, dy: 1 } },
        { op: "walk", who: "evelio", run: true, to: { dx: 1, dy: 2 } },
      ],
    },
    { op: "together", steps: [{ op: "face", who: "aurora", toward: "yo" }, { op: "face", who: "gloria", toward: "yo" }, { op: "face", who: "evelio", toward: "yo" }] },
    { op: "flash", color: "oro", ms: 400 },
    {
      op: "together",
      steps: [
        { op: "title", text: f.nombre, sub: "¡Empezó el festival!", ms: 2600 },
        { op: "act", who: "aurora", action: "bailar" },
        { op: "act", who: "gloria", action: "bailar" },
        { op: "act", who: "evelio", action: "saltar" },
        { op: "act", who: "yo", action: "bailar" },
        { op: "fx", fx: "confeti", who: "yo" },
      ],
    },
    ...extra,
    { op: "say", who: "aurora", text: lines[0], ms: 3200 },
    { op: "say", who: "gloria", text: lines[1], ms: 3200 },
    { op: "together", steps: [{ op: "act", who: "aurora", action: "saludar" }, { op: "act", who: "gloria", action: "saludar" }, { op: "act", who: "evelio", action: "saludar" }] },
    {
      op: "together",
      steps: [
        { op: "walk", who: "aurora", to: { dx: 7, dy: -1 } },
        { op: "walk", who: "gloria", to: { dx: -7, dy: -1 } },
        { op: "walk", who: "evelio", to: { dx: 2, dy: 7 } },
      ],
    },
    { op: "despawn", id: "aurora" },
    { op: "despawn", id: "gloria" },
    { op: "despawn", id: "evelio" },
  ],
});

/** Cierre: Aurora y Gloria pasan a despedirse, aplauden y se van caminando juntas. */
const close = (f: FestivalDef, text: string): CineDef => ({
  id: festivalCineId(f.id, "cierre"),
  kind: "momento",
  steps: [
    { op: "spawn", id: "aurora", like: "aurora", at: { dx: 5, dy: 3 }, facing: "left" },
    { op: "spawn", id: "gloria", like: "gloria", at: { dx: 6, dy: 2 }, facing: "left" },
    { op: "together", steps: [{ op: "walk", who: "aurora", to: { dx: 2, dy: 1 } }, { op: "walk", who: "gloria", to: { dx: 2, dy: 0 } }] },
    { op: "together", steps: [{ op: "face", who: "aurora", toward: "yo" }, { op: "face", who: "gloria", toward: "yo" }] },
    { op: "sound", sound: "aplausos" },
    {
      op: "together",
      steps: [
        { op: "fx", fx: "confeti" },
        { op: "title", text: `¡Gracias por venir!`, sub: f.nombre, ms: 2400 },
        { op: "act", who: "aurora", action: "celebrar" },
        { op: "act", who: "gloria", action: "saltar" },
      ],
    },
    { op: "say", who: "aurora", text, ms: 3200 },
    { op: "together", steps: [{ op: "act", who: "aurora", action: "saludar" }, { op: "act", who: "gloria", action: "saludar" }, { op: "emote", who: "yo", emote: "wave" }] },
    { op: "together", steps: [{ op: "walk", who: "aurora", to: { dx: -4, dy: 5 } }, { op: "walk", who: "gloria", to: { dx: -3, dy: 6 } }] },
    { op: "despawn", id: "aurora" },
    { op: "despawn", id: "gloria" },
  ],
});

/** Llegó con la fiesta andando: Gloria sale a recibirlo corriendo. */
const late = (f: FestivalDef): CineDef => ({
  id: festivalCineId(f.id, "llegada"),
  kind: "momento",
  steps: [
    { op: "spawn", id: "gloria", like: "gloria", at: { dx: -5, dy: 2 }, facing: "right" },
    { op: "walk", who: "gloria", run: true, to: { dx: -1, dy: 1 } },
    { op: "face", who: "gloria", toward: "yo" },
    { op: "sound", sound: "destello" },
    { op: "together", steps: [{ op: "act", who: "gloria", action: "saltar" }, { op: "title", text: f.nombre, sub: "Llegaste en plena fiesta", ms: 2600 }] },
    { op: "bubble", who: "gloria", text: "¡Venga, que esto apenas empieza!" },
    { op: "walk", who: "gloria", to: { dx: 4, dy: -2 } },
    { op: "despawn", id: "gloria" },
  ],
});

const byId = (id: FestivalId) => festivalById(id)!;

/** Las cinemáticas de los festivales (se suman al catálogo de cinemáticas). */
export const FESTIVAL_CINEMATICAS: readonly CineDef[] = [
  open(byId("amor-amistad"), ["¡Feliz amor y amistad! Hoy se sortea el amigo secreto.", "Los dulces van al buzón sin firma. Que nadie se delate."], [
    { op: "fx", fx: "corazones" },
  ]),
  close(byId("amor-amistad"), "Qué bonito ver tanto cariño en esta casa. Hasta el reloj parece contento."),
  open(byId("feria-flores"), ["¡Llegaron los silleteros! El jardín está que revienta de flores.", "Arme su silleta con lo del huerto y la exhibimos en el patio."], [
    { op: "fx", fx: "chispas" },
  ]),
  close(byId("feria-flores"), "Las silletas quedan en el patio unos días, pa' que las vean los que no vinieron."),
  open(byId("cometas"), ["¡Sopla el viento del verano! A elevar cometas en el jardín.", "Gana la que suba más alto. Cuidado con los faroles."], [
    { op: "sound", sound: "brisa" },
  ]),
  close(byId("cometas"), "Recojan las cometas, que la última se fue pal lago con todo y cola."),
  open(byId("carnaval"), ["¡Quien lo vive es quien lo goza! Arrancó el carnaval.", "La comparsa sale del portón. Saquen las máscaras y la maicena."], [
    { op: "fx", fx: "confeti" },
    { op: "emote", who: "yo", emote: "dance" },
  ]),
  close(byId("carnaval"), "Se acabó el carnaval… hasta el año que viene. Lávense la maicena."),
  open(byId("cosecha"), ["¡Feria de la cosecha! Traigan lo mejor del huerto, la granja y el lago.", "Los jueces pasan a mediodía: que todo brille."], [
    { op: "fx", fx: "estrellas" },
  ]),
  close(byId("cosecha"), "Las cintas ya están repartidas. El año que viene, a sembrar con más ganas."),
  open(byId("brujas"), ["Esta noche la cabaña se pone rara… dulce o truco por todas las puertas.", "El laberinto de maíz está abierto. Dicen que adentro hay una calabaza dorada."], [
    { op: "sound", sound: "trueno" },
    { op: "flash", color: "blanco", ms: 250 },
  ]),
  close(byId("brujas"), "¿Oyeron eso? Juraría que el reloj del recibidor sonó trece veces…"),
  open(byId("velitas"), ["Noche de velitas: prenda la suya y pida un deseo.", "A medianoche soltamos los faroles en el lago, todos juntos."], [
    { op: "fx", fx: "estrellas" },
  ]),
  close(byId("velitas"), "Que se cumplan todos los deseos que subieron con los faroles."),
  open(byId("novenas"), ["Empiezan las novenas: cada noche una figura nueva pa'l pesebre.", "Hay natilla y buñuelos en la cocina. ¡Y aguinaldos!"], [
    { op: "sound", sound: "campanada" },
  ]),
  close(byId("novenas"), "Mañana seguimos con la novena. Que no se le olvide la natilla."),
  open(byId("ano-viejo"), ["¡Último día del año de la cabaña! Esta noche se quema el año viejo.", "Tenga las doce uvas listas y la maleta a la mano."], [
    { op: "fx", fx: "confeti" },
  ]),
  close(byId("ano-viejo"), "¡Feliz año nuevo, mijo! Que este año la cabaña nos dé muchas sorpresas."),
  ...FESTIVALES.map(late),
];
