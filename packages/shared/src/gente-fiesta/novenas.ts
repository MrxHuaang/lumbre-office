// La gente de las Novenas de aguinaldo (VIR-167): en el recibidor, la abuela de los buñuelos (con su pedido
// de harina), el niño de la pandereta y los que llegan a la novena de las 20:00 (dos se sientan, los demás
// rezan de pie frente al pesebre); en el jardín, los que cantan villancicos frente al porche, los niños que
// corren, el señor de la natilla y los de siempre. Lo que dicen cambia con el día de la novena.
import type { FiestaNpc } from "../gente-fiesta";
import { NOVENA } from "../novenas";
import { canelo, hora, nino, papel, suelto } from "./comun";

const F = "novenas";
const MARIANA = `${F}:mariana`;
/** Los que llegan a la novena: entran por la puerta del recibidor un rato antes de las 20:00 y se van al terminar. */
const NOVENA_HORARIO = { desde: hora(NOVENA.hora) - 25, hasta: hora(NOVENA.hasta) + 15 };
const PUERTA = { x: 17, y: 24 };
const ABRIGO = (shirt: string) => ({ outfit: "coat" as const, shirt });

export function GENTE_NOVENAS(): FiestaNpc[] {
  return [
    // ---- El recibidor ----
    papel(F, "rubiela", {
      rol: "Reparte buñuelos",
      area: "planta-baja",
      tile: { x: 17, y: 21 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { outfit: "apron", shirt: "#a83a3a", head: "bandana", accent: "#3a8a4a" },
      lluvia: "sigue",
      frases: {
        hola: ["¡Buñuelos calienticos pa' la novena! Coja uno, que hay pa' todos.", "El secreto del buñuelo es el queso costeño. Y la paciencia.", "Mis nietos me ayudan a amasar. Bueno, a comerse la masa."],
        dias: {
          1: ["Primer día de novena: hoy se pone la primera figura. Que no se le olvide."],
          5: ["Ya vamos en la mitad de la novena. Y yo en la mitad de la harina."],
          9: ["Último día de novena: esta noche llega el Niño. Los buñuelos van con todo."],
        },
      },
      murmullos: ["¡Buñuelos calienticos!", "Coja uno, mijo", "Con queso costeño"],
      pedido: {
        id: "harina-rubiela",
        pide: [{ item: "harina", n: 2 }],
        da: { item: "bunuelo", n: 3 },
        texto: "¿Me hace un favor? Se me acabó la harina. Tráigame dos del molino y le doy buñuelos recién hechos.",
        gracias: "¡Harina del molino, qué belleza! Tenga sus buñuelos, que estos no se los quita nadie.",
      },
    }),
    suelto(F, "juanpis", "Juanpis", nino("#f1c27d", "#3a2418", { outfit: "coat", shirt: "#3a8a4a", head: "beanie" }), {
      rol: "Toca la pandereta",
      area: "planta-baja",
      tile: { x: 14, y: 18 },
      comportamiento: { tipo: "baila", mira: "down" },
      lluvia: "sigue",
      voz: 0.86,
      frases: { hola: ["¡Tutaina tuturumá! Me sé la de la pandereta completa.", "Mi abuela dice que toco duro. Yo digo que toco con ganas.", "En la novena de hoy me toca leer la oración. Qué nervios."] },
      murmullos: ["¡Chiqui, chiqui!", "Tutaina tuturumá", "Tun, tun, tun"],
    }),
    papel(F, "marina", {
      rol: "Dirige la novena",
      area: "planta-baja",
      tile: { x: 11, y: 24 },
      horario: NOVENA_HORARIO,
      llega: PUERTA,
      comportamiento: { tipo: "sentado", asiento: { x: 11, y: 24 } },
      pinta: ABRIGO("#4a5a7a"),
      lluvia: "sigue",
      frases: {
        hola: ["La novena es a las ocho, y el que llegue tarde reza el doble.", "Hoy leemos la consideración del día. Con buena entonación, ¿oyó?"],
        dias: { 9: ["Hoy es el último día: los gozos se cantan con más ganas."] },
      },
      murmullos: ["Benignísimo Dios…", "Ven, no tardes", "Más despacio"],
    }),
    papel(F, "carmenza", {
      rol: "Reza la novena",
      area: "planta-baja",
      tile: { x: 11, y: 25 },
      horario: NOVENA_HORARIO,
      llega: PUERTA,
      comportamiento: { tipo: "sentado", asiento: { x: 11, y: 25 } },
      pinta: ABRIGO("#7a2a46"),
      lluvia: "sigue",
      frases: { hola: ["Siéntese donde pueda, mijo. Las sillas buenas ya se las cogimos.", "Le cosí a la Virgen del pesebre un mantico nuevo. ¿Se nota?"] },
      murmullos: ["Amén", "Ven, ven, ven…", "Qué pesebre tan lindo"],
    }),
    papel(F, "aurelio", {
      rol: "Reza de pie (y canta los gozos)",
      area: "planta-baja",
      tile: { x: 13, y: 19 },
      horario: NOVENA_HORARIO,
      llega: PUERTA,
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: ABRIGO("#5a4a3a"),
      lluvia: "sigue",
      frases: { hola: ["Los gozos son mi parte favorita. Se pueden cantar bailando.", "¿Ya vio el pesebre? El burrito lo puse yo. Bueno, me ayudaron."] },
      murmullos: ["¡Ven, no tardes!", "Dulce Jesús mío…", "¿Ya hay buñuelos?"],
    }),
    papel(F, "ramiro", {
      rol: "Reza frente al pesebre",
      area: "planta-baja",
      tile: { x: 12, y: 23 },
      horario: NOVENA_HORARIO,
      llega: PUERTA,
      comportamiento: { tipo: "quieto", mira: "up" },
      lluvia: "sigue",
      frases: { hola: ["En la loma rezamos la novena con la familia entera. Aquí también me siento en familia.", "Ese musgo del pesebre lo traje yo de la montaña."] },
      murmullos: ["Amén", "Qué musgo tan bueno", "La tierra no tiene afán"],
    }),
    papel(F, "luzdary", {
      rol: "Viene a la novena",
      area: "planta-baja",
      tile: { x: 13, y: 22 },
      horario: NOVENA_HORARIO,
      llega: PUERTA,
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: ABRIGO("#2a6a6a"),
      lluvia: "sigue",
      frases: { hola: ["Vine derecho del consultorio. El perro de Chepe se tragó una media.", "Me encanta que el pesebre tenga animales. El burrito está bien cuidado."] },
      murmullos: ["Amén", "Qué bonito", "El burrito…"],
    }),
    // ---- El jardín ----
    papel(F, "tomas", {
      rol: "Canta villancicos con el tiple",
      area: "jardin",
      tile: { x: 62, y: 35 },
      comportamiento: { tipo: "grupo", grupo: "villancicos", centro: { x: 63, y: 35 } },
      pinta: ABRIGO("#3a6a4a"),
      farol: "velita",
      frases: { hola: ["¡Tutaina tuturumá! Cante con nosotros, que el coro está flojo.", "Esta la compuse anoche: un villancico con bambuco.", "«Los peces en el río» suena mejor con tiple. Es un hecho."] },
      murmullos: ["Tutaina tuturumá…", "Los peces en el río…", "¡Ven, ven, ven!"],
    }),
    papel(F, "valentina", {
      rol: "Canta villancicos (y graba)",
      area: "jardin",
      tile: { x: 64, y: 35 },
      comportamiento: { tipo: "grupo", grupo: "villancicos", centro: { x: 63, y: 35 } },
      pinta: { ...ABRIGO("#c03a4a"), head: "pompom-beanie" },
      farol: "velita",
      frases: { hola: ["Cantamos villancicos para el canal. Usted salió en la toma.", "Tomás se sabe todos los villancicos. Yo me sé los coros."] },
      murmullos: ["Mientras el mundo…", "¡Coro!", "Esto va al canal"],
    }),
    papel(F, "santiago", {
      rol: "Toca las maracas",
      area: "jardin",
      tile: { x: 63, y: 36 },
      comportamiento: { tipo: "grupo", grupo: "villancicos", centro: { x: 63, y: 35 } },
      pinta: { ...ABRIGO("#3a3a4a"), head: "beanie" },
      farol: "velita",
      frases: { hola: ["Yo toco las maracas. No hay mucho que saber.", "¿Hay wifi en la novena? Necesito la letra."] },
      murmullos: ["Chiqui, chiqui", "¿Cómo era la letra?", "Ven, ven…"],
    }),
    papel(F, "mariana", {
      rol: "Juega antes de la novena",
      area: "jardin",
      tile: { x: 58, y: 44 },
      comportamiento: { tipo: "deambula", zona: { x: 52, y: 38, w: 20, h: 18 }, paradas: 6, pausa: 0.7 },
      pinta: { ...ABRIGO("#e05a7a"), head: "pompom-beanie" },
      farol: "farol-deseos",
      frases: { hola: ["¿Usted ya puso su figura en el pesebre? Hoy me tocaba a mí, pero llegué tarde.", "Canelo se comió un buñuelo de doña Rubiela. Shhh."] },
      murmullos: ["¡Canelo!", "¡Ya va a empezar!", "Pajita en boca"],
    }),
    canelo(F, MARIANA, { x: 57, y: 44 }),
    suelto(F, "sofi", "Sofi", nino("#c68642", "#1b1b1b", { hairStyle: "braids", outfit: "coat", shirt: "#e8c03a", head: "pompom-beanie" }), {
      rol: "Juega con Mariana",
      area: "jardin",
      tile: { x: 56, y: 44 },
      comportamiento: { tipo: "sigue", a: MARIANA, distancia: 2.4, corre: true },
      farol: "farol-deseos",
      voz: 0.95,
      frases: { hola: ["Jugamos a pajita en boca. Usted ya perdió porque habló.", "Este año pedí una bicicleta. Como la de Fredy, pero rosada."] },
      murmullos: ["¡Perdió!", "¡Mariana, espere!", "Sí y no…"],
    }),
    papel(F, "efrain", {
      rol: "Vende natilla",
      area: "jardin",
      tile: { x: 57, y: 52 },
      comportamiento: { tipo: "quieto", mira: "right" },
      pinta: ABRIGO("#6a4a2a"),
      frases: {
        hola: ["¡Natilla de la casa! La de la novena, con su canelita.", "La natilla se revuelve sin parar. Si para, se pega. Como la vida."],
        noche: ["A las ocho todos se van a la novena y yo me quedo con la natilla. No es mal negocio."],
      },
      murmullos: ["¡Natilla de la casa!", "Con canelita", "Revuelva sin parar"],
      pedido: {
        id: "queso-efrain",
        pide: [{ item: "queso", n: 1 }],
        da: { puntos: 6 },
        texto: "Pa' los buñuelos de la vecina me falta un queso. ¿Me lo consigue en la cafetería? Le quedo debiendo.",
        gracias: "¡Ese es el queso! Ya se lo llevo a doña Rubiela. Gracias, mijo.",
      },
    }),
    papel(F, "fredy", {
      rol: "Sube y baja el camino",
      area: "jardin",
      tile: { x: 62, y: 104 },
      comportamiento: { tipo: "ronda", paradas: [{ x: 62, y: 104, pausa: 1.5 }, { x: 62, y: 40, pausa: 1.5 }] },
      pinta: ABRIGO("#e8c03a"),
      frases: { hola: ["Diciembre es el mes de las cicloviadas largas. Y de los buñuelos, para reponer.", "Del portón al porche, ida y vuelta: dos kilómetros diarios de novena."] },
      murmullos: ["Ida y vuelta", "Dos kilómetros", "¡Buenas!"],
    }),
    papel(F, "chepe", {
      rol: "Comenta la decoración",
      area: "jardin",
      tile: { x: 68, y: 31 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: ABRIGO("#5a5a6a"),
      frases: { hola: ["¿Ya vio las luces del porche? Las conectó Fredy. Por eso titilan raro.", "Le cuento algo: la figura de anoche la puso alguien que no rezó. Ahí lo dejo."] },
      murmullos: ["Ahí lo dejo", "Esas luces titilan raro", "¿Ya supo?"],
    }),
  ];
}
