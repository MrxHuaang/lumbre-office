// La gente del Año viejo (VIR-170): la familia que sale con las maletas a darle la vuelta al jardín (la misma
// ronda del agüero), Don Aurelio con el acordeón y Tomás con la guacharaca tocando en la plaza, Doña Rubiela
// repartiendo buñuelos, Doña Carmenza cosiéndole la ropa al muñeco, la profe Marina leyendo los testamentos,
// Don Efraín vendiendo el muñeco y la ropa vieja (abre el puesto), los niños con sus varitas de luz (nada de
// pólvora), Valentina y Santiago grabando y Chepe con Don Ramiro chismoseando junto al brasero.
import { MALETA_RUTA } from "../ano-viejo";
import type { FiestaNpc, Parada } from "../gente-fiesta";
import { canelo, hora, nino, papel, suelto } from "./comun";

const F = "ano-viejo";
const FREDY = `${F}:fredy`;
const MARIANA = `${F}:mariana`;
/** La vuelta de la maleta: una pausa cortica en cada parada y otra más larga al volver a la plaza. */
const VUELTA: readonly Parada[] = MALETA_RUTA.map((p, i) => ({ ...p, pausa: i === 0 ? 6 : 1 }));
/** La plaza del año viejo (tiles del jardín). */
const PLAZA = { x: 66, y: 30, w: 18, h: 7 };
const AMARILLO = "#f2c230";

export function GENTE_ANO_VIEJO(): FiestaNpc[] {
  return [
    // La familia de las maletas: Fredy adelante, Luz Dary y Mariana detrás, y Canelo.
    papel(F, "fredy", {
      rol: "Le da la vuelta al jardín con la maleta",
      area: "jardin",
      tile: MALETA_RUTA[0]!,
      comportamiento: { tipo: "ronda", paradas: VUELTA },
      pinta: { top: "polo", bottom: "pants", shirt: AMARILLO, head: "party-hat", face: undefined },
      lleva: "maleta",
      frases: {
        hola: [
          "Una vuelta con la maleta y el año trae viajes. Yo la doy en bicicleta, pero hoy toca a pie.",
          "Ya vamos en la tercera vuelta. Luz Dary dice que con una basta, pero uno nunca sabe.",
          "Las paradas están marcadas con un letrerito. Pásele por todas, en orden, y vuelva a la plaza.",
        ],
        noche: ["De noche la vuelta se siente más larga. Serán los buñuelos."],
      },
      murmullos: ["¡Otra vuelta!", "Parada cuatro…", "Este año sí viajamos"],
    }),
    papel(F, "luzdary", {
      rol: "Sigue a Fredy con su maleta",
      area: "jardin",
      tile: { x: MALETA_RUTA[0]!.x, y: MALETA_RUTA[0]!.y + 1 },
      comportamiento: { tipo: "sigue", a: FREDY, distancia: 1.4 },
      pinta: { outfit: "coat", shirt: AMARILLO, pants: "#5a4a3a" },
      lleva: "maleta",
      frases: {
        hola: [
          "Yo voy por Mariana y por Canelo. Fredy va por los kilómetros.",
          "Este año me pido un viaje a la costa. Con la maleta y las lentejas, ¿qué puede fallar?",
          "¿Ya tiene su ropa amarilla? Es para la buena suerte.",
        ],
      },
      murmullos: ["Despacio, Fredy", "¡Canelo, por aquí!", "Ya casi llegamos"],
    }),
    papel(F, "mariana", {
      rol: "Lleva la maleta más chiquita",
      area: "jardin",
      tile: { x: MALETA_RUTA[0]!.x + 1, y: MALETA_RUTA[0]!.y + 1 },
      comportamiento: { tipo: "sigue", a: `${F}:luzdary`, distancia: 1.3 },
      pinta: { shirt: AMARILLO, head: "bow" },
      lleva: "maleta",
      frases: {
        hola: [
          "¡Mi maleta es la más chiquita pero la más bonita!",
          "Si le doy la vuelta al jardín, ¿me voy a ir a la playa? Mi papá dice que sí.",
          "Canelo también quiere viajar. Le puse una maletica imaginaria.",
        ],
      },
      murmullos: ["¡Voy a la playa!", "¡Canelo, ven!", "¿Ya llegamos?"],
    }),
    canelo(F, MARIANA, { x: MALETA_RUTA[0]!.x + 1, y: MALETA_RUTA[0]!.y + 2 }),
    // La orquesta de fin de año: Don Aurelio con el acordeón y Tomás con la guacharaca.
    papel(F, "aurelio", {
      rol: "Toca el acordeón de fin de año",
      area: "jardin",
      tile: { x: 73, y: 35 },
      comportamiento: { tipo: "quieto", mira: "up" },
      pinta: { top: "dress-shirt", shirt: "#f4ecdc", head: "vueltiao" },
      lleva: "acordeon",
      frases: {
        hola: [
          "Este porro lo compuse para despedir el año. Se llama «El último tinto de diciembre».",
          "En los ferrocarriles tocábamos en el vagón comedor hasta que amanecía.",
          "Si me ve cansado, pídame otra. El acordeón no se cansa.",
        ],
        noche: ["Ya casi es la hora del muñeco. Esa la toco despacito, con sentimiento."],
      },
      murmullos: ["¡Esa es la que es!", "Otra, otra", "¡Que suene el fuelle!"],
    }),
    papel(F, "tomas", {
      rol: "Lleva el ritmo con la guacharaca",
      area: "jardin",
      tile: { x: 75, y: 35 },
      comportamiento: { tipo: "quieto", mira: "up" },
      pinta: { top: "dress-shirt", shirt: AMARILLO, head: "vueltiao" },
      lleva: "guacharaca",
      frases: {
        hola: [
          "Hoy dejé el tiple en la casa: el porro pide guacharaca.",
          "Don Aurelio no se sabe la letra, pero el acordeón sí.",
          "A las nueve y media tocamos para la quema. Bajito, que es un momento serio.",
        ],
      },
      murmullos: ["Chiqui, chiqui…", "¡Eso, Don Aurelio!", "Un porrito más"],
    }),
    // La abuela de los buñuelos (con su pedido).
    papel(F, "rubiela", {
      rol: "Reparte buñuelos",
      area: "jardin",
      tile: { x: 68, y: 34 },
      comportamiento: { tipo: "quieto", mira: "right" },
      pinta: { outfit: "apron", shirt: "#c0392b", top2: "#e8d8b0" },
      lleva: "bunuelo",
      frases: {
        hola: [
          "¡Buñuelos calienticos para despedir el año! Sírvase uno, que no se los vendo.",
          "Mis nietos se comen los buñuelos antes de que se enfríen. Y yo los dejo.",
          "El buñuelo bien hecho flota y queda redondito. Como debe ser el año que viene.",
        ],
        noche: ["A medianoche se comen las uvas, pero antes un buñuelo, para tener fuerzas."],
      },
      murmullos: ["¡Buñuelos calienticos!", "Sírvase uno", "Con natilla, mejor"],
      pedido: {
        id: "huevos-rubiela",
        pide: [{ item: "huevo", n: 2 }],
        da: { item: "bunuelo", n: 2 },
        texto: "Se me acabaron los huevos y la gente sigue llegando. ¿Me trae dos del gallinero? Le doy buñuelos.",
        gracias: "¡Qué bendición! Tenga sus buñuelos, recién salidos de la paila.",
      },
    }),
    // El que vende el muñeco y la ropa vieja (abre el puesto, con su pedido).
    papel(F, "efrain", {
      rol: "Vende el muñeco y la ropa vieja",
      area: "jardin",
      tile: { x: 84, y: 32 },
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: { outfit: "apron", shirt: AMARILLO, head: "cap" },
      accion: { tipo: "puesto" },
      frases: {
        hola: [
          "¡Ropa vieja para el muñeco, caretas pintadas a mano y varitas de luz para los niños!",
          "Las uvas, la maleta y las lentejas se las regalo: el agüero no se cobra.",
          "Ese muñeco lo estamos armando entre todos. Póngale algo, que todavía está flaco.",
        ],
      },
      murmullos: ["¡Ropa vieja, ropa vieja!", "Caretas a la orden", "Las uvas son gratis"],
      pedido: {
        id: "aserrin-efrain",
        pide: [{ item: "aserrin", n: 1 }],
        da: { item: "careta-muneco", n: 1 },
        texto: "Me falta relleno para el muñeco que estoy armando. ¿Me trae un costal de aserrín del taller del garaje? Le doy una careta.",
        gracias: "¡Eso es aserrín del bueno! Tenga su careta, que le quedó con bigote y todo.",
      },
    }),
    // Doña Carmenza le cose la ropa al muñeco, junto a la silla.
    papel(F, "carmenza", {
      rol: "Le cose la ropa al muñeco",
      area: "jardin",
      tile: { x: 74, y: 32 },
      comportamiento: { tipo: "quieto", mira: "right" },
      pinta: { shirt: AMARILLO, neck: "pearls" },
      frases: {
        hola: [
          "Este muñeco va a quedar más elegante que mi difunto. Que Dios lo tenga en su gloria.",
          "Tráigale una camisa vieja y yo se la acomodo. Para eso soy modista.",
          "El año viejo se va bien vestido o no se va.",
        ],
      },
      murmullos: ["Una puntada más…", "¡Qué elegancia!", "Tráigame un botón"],
    }),
    // La profe Marina lee los testamentos del cartel en voz alta.
    papel(F, "marina", {
      rol: "Lee los testamentos del cartel",
      area: "jardin",
      tile: { x: 72, y: 31 },
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: { shirt: AMARILLO, top: "cardigan" },
      frases: {
        hola: [
          "Escriba su testamento en el cartel: lo que deja del año. Corto y sin groserías, por favor.",
          "Alguien dejó «las ganas de madrugar». Esa la firmo yo también.",
          "Los testamentos se queman con el muñeco. Lo bueno se queda; lo malo se va con el humo.",
        ],
      },
      murmullos: ["«Dejo mis deudas…»", "Sin groserías, por favor", "¡Qué testamento!"],
    }),
    // Chepe y Don Ramiro chismosean junto al brasero.
    papel(F, "chepe", {
      rol: "Revisa el brasero (y chismosea)",
      area: "jardin",
      tile: { x: 79, y: 30 },
      comportamiento: { tipo: "grupo", grupo: "brasero", centro: { x: 80, y: 30 } },
      pinta: { outfit: "coveralls", shirt: AMARILLO },
      frases: {
        hola: [
          "El brasero es de piedra y lo revisé tres veces. Aquí se quema el muñeco y nada más.",
          "Dicen que al muñeco le pusieron la corbata del cuidador de antes. Yo no dije nada.",
        ],
      },
      murmullos: ["No diga que fui yo", "Piedra de la buena", "¿Ya supo?"],
    }),
    papel(F, "ramiro", {
      rol: "Bajó de la loma para la quema",
      area: "jardin",
      tile: { x: 81, y: 30 },
      comportamiento: { tipo: "grupo", grupo: "brasero", centro: { x: 80, y: 30 } },
      frases: {
        hola: [
          "En la loma el año viejo lo quemamos en la era, con toda la vereda. Aquí también se siente bonito.",
          "Paloma se quedó en la casa: a la mula no le gustan las fiestas.",
        ],
      },
      murmullos: ["La tierra no tiene afán", "Qué frío", "Ya casi"],
    }),
    // Valentina graba todo para despedir el año (de cara al brasero).
    papel(F, "valentina", {
      rol: "Graba la despedida del año",
      area: "jardin",
      tile: { x: 78, y: 37 },
      comportamiento: { tipo: "quieto", mira: "up" },
      pinta: { outfit: "coat", shirt: AMARILLO },
      frases: {
        hola: [
          "Voy a hacer el resumen del año en un video de quince segundos. Tú sales en el segundo nueve.",
          "La quema la grabo desde aquí: buena luz, buena distancia y nada de humo en la cara.",
        ],
      },
      murmullos: ["¡Qué toma!", "Salude a cámara", "Otra vez, otra vez"],
    }),
    // Los niños con varitas de luz (de noche brillan; de día las tienen guardadas).
    suelto(F, "juanpis", "Juanpis", nino("#f1c27d", "#3a2418", { outfit: "coat", shirt: AMARILLO, head: "party-hat" }), {
      rol: "Corre con su varita de luz",
      area: "jardin",
      tile: { x: 70, y: 33 },
      comportamiento: { tipo: "deambula", zona: PLAZA, paradas: 6, pausa: 0.6 },
      farol: "varita-luz",
      voz: 0.86,
      frases: {
        hola: ["¡Mira mi varita! Brilla de colores y no hace ruido.", "Mi mamá dice que la pólvora no, que las varitas sí. Y tiene razón.", "¿Ya escribiste tu testamento? Yo dejé las tareas de matemáticas."],
      },
      murmullos: ["¡Mira mi varita!", "¡Sofi, espérame!", "¡Feliz año!"],
    }),
    suelto(F, "sofi", "Sofi", nino("#c68642", "#1b1b1b", { hairStyle: "braids", outfit: "coat", shirt: "#e8457a", head: "party-hat" }), {
      rol: "Juega con su varita de luz",
      area: "jardin",
      tile: { x: 78, y: 34 },
      comportamiento: { tipo: "deambula", zona: PLAZA, paradas: 6, pausa: 0.8 },
      farol: "varita-luz",
      voz: 0.95,
      horario: { desde: hora(12), hasta: hora(22) },
      frases: {
        hola: ["Mi varita es rosada porque el rosado da suerte. Bueno, el amarillo también.", "A mí me da miedo el ruido, por eso me gustan las luces.", "¿Tú te vas a comer las doce uvas? Yo me como seis y ya."],
      },
      murmullos: ["¡Qué lucecitas!", "¡Juanpis!", "Doce uvas…"],
    }),
  ];
}
