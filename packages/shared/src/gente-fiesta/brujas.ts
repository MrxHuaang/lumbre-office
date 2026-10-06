// La gente de la Noche de brujas (VIR-167): los niños disfrazados que piden dulces de puerta en puerta (la
// garaje, la casa y la escalera del balcón), el corrillo que cuenta historias de miedo junto a la fogata, la
// bruja del caldero (abre el puesto), los abuelos que bailan, la profe junto al cementerio de cartón y los
// pedidos de Don Efraín y Don Ramiro. Todo en tiles del jardín (y Luz Dary en el recibidor).
import type { FiestaNpc } from "../gente-fiesta";
import { canelo, nino, papel, suelto } from "./comun";

const F = "brujas";
const MARIANA = `${F}:mariana`;
/** Las puertas del jardín donde los niños piden dulces (de frente a cada una). */
const PUERTAS = [
  { x: 50, y: 30, mira: "up", pausa: 2 },
  { x: 61, y: 30, mira: "up", pausa: 2.5 },
  { x: 73, y: 30, mira: "up", pausa: 2 },
  { x: 66, y: 40 },
  { x: 55, y: 40 },
] as const;

export function GENTE_BRUJAS(): FiestaNpc[] {
  return [
    papel(F, "rubiela", {
      rol: "La bruja del caldero",
      area: "jardin",
      tile: { x: 51, y: 116 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { costume: "bruja", costumeGear: true },
      accion: { tipo: "puesto" },
      lluvia: "sigue",
      frases: {
        hola: ["¡Jijiji! Pase, mijo, que el caldero no muerde.", "Dulces encantados y un sombrero de bruja. ¿Qué se lleva?", "Este caldero lo heredé de mi abuela. Bueno, era una olla de tamales."],
        noche: ["A esta hora los dulces saben más a miedo. Y a fresa."],
        lluvia: ["Con este aguacero el caldero hierve solito."],
      },
      murmullos: ["Dulces encantados…", "¡Jijiji!", "Pruebe, que no embruja.", "El caldero está calientico"],
    }),
    papel(F, "mariana", {
      rol: "Pide dulces disfrazada de calabaza",
      area: "jardin",
      tile: { x: 55, y: 40 },
      comportamiento: { tipo: "ronda", paradas: PUERTAS },
      pinta: { costume: "calabaza", costumeGear: true },
      farol: "farol-deseos",
      frases: {
        hola: ["¡Dulce o truco! ¿Usted no tiene dulces? Entonces truco.", "Soy una calabaza. Canelo es un fantasma, pero no se deja poner la sábana.", "En la puerta del garaje me dieron una chupeta. ¡Vaya!"],
        tarde: ["Ya llevo siete dulces. Juanpis lleva cinco, pero se comió dos."],
        noche: ["De noche da más miedo tocar las puertas. Pero dan más dulces."],
      },
      murmullos: ["¡Dulce o truco!", "¡Canelo, vuelva acá!", "Esa puerta da bombones"],
    }),
    canelo(F, MARIANA, { x: 54, y: 40 }),
    suelto(F, "juanpis", "Juanpis", nino("#f1c27d", "#3a2418", { costume: "esqueleto", costumeGear: true }), {
      rol: "Pide dulces disfrazado de esqueleto",
      area: "jardin",
      tile: { x: 54, y: 41 },
      comportamiento: { tipo: "sigue", a: MARIANA, distancia: 2.2, corre: true },
      farol: "farol-deseos",
      voz: 0.86,
      frases: { hola: ["¡Buuu! ¿Se asustó? Diga que sí.", "Mis huesos brillan en la oscuridad. Bueno, casi.", "Mariana manda. Yo cargo la canasta."] },
      murmullos: ["¡Buuu!", "¡Espérenme!", "Me dieron un masmelo"],
    }),
    suelto(F, "sofi", "Sofi", nino("#c68642", "#1b1b1b", { hairStyle: "braids", costume: "vampiro", costumeGear: true }), {
      rol: "Pide dulces disfrazada de vampira",
      area: "jardin",
      tile: { x: 53, y: 41 },
      comportamiento: { tipo: "sigue", a: MARIANA, distancia: 3.4, corre: true },
      farol: "farol-deseos",
      voz: 0.95,
      frases: { hola: ["Quiero chocolatinas… ¡muajaja!", "Los colmillos son de plástico, pero muerden.", "La próxima puerta es la de la casa grande. ¡Vamos!"] },
      murmullos: ["¡Muajaja!", "¡Dulce o truco!", "¿Me da un chocolate?"],
    }),
    // El corrillo de la fogata: historias de miedo por turnos, sentados en los troncos.
    papel(F, "chepe", {
      rol: "Cuenta historias de miedo",
      area: "jardin",
      tile: { x: 34, y: 64 },
      comportamiento: { tipo: "sentado", asiento: { x: 34, y: 64 } },
      charla: "fogata",
      pinta: { costume: "vampiro", costumeGear: true },
      frases: {
        hola: ["Siéntese, que ya viene lo bueno: la del cuidador que se fue sin avisar…", "Dicen que en el sótano hay una puerta que nadie abre. Yo sé por qué.", "¿Usted ha oído el reloj dar trece? Yo sí. Y no había reloj."],
        noche: ["Ahora sí, con la luna arriba, le cuento la de la Llorona del lago."],
      },
      murmullos: ["Y entonces… ¡se apagó!", "Era una noche como esta…", "Nadie volvió a verlo", "Les juro que es verdad"],
    }),
    papel(F, "tomas", {
      rol: "Pone la música de miedo con el tiple",
      area: "jardin",
      tile: { x: 37, y: 66 },
      comportamiento: { tipo: "sentado", asiento: { x: 37, y: 66 } },
      charla: "fogata",
      pinta: { head: "witch-hat", accent: "#2a2430" },
      frases: { hola: ["Le pongo música a las historias de Chepe. Las de miedo van en menor.", "Esta la compuse anoche: «El bambuco del espanto».", "Si oye un tiple solito en el lago, no soy yo."] },
      murmullos: ["Tlin… tlan… tlin…", "Esta va en menor", "Uy, qué susto"],
    }),
    papel(F, "valentina", {
      rol: "Graba las historias para sus seguidores",
      area: "jardin",
      tile: { x: 32, y: 67 },
      comportamiento: { tipo: "sentado", asiento: { x: 32, y: 67 } },
      charla: "fogata",
      pinta: { costume: "bruja", costumeGear: true },
      frases: { hola: ["Shhh, estoy en vivo. Salude a los seguidores.", "Si esta historia llega a mil vistas, me disfrazo de calabaza el año entrante.", "Chepe exagera todo, pero da miedo igual."] },
      murmullos: ["Shhh, estoy en vivo", "¡Qué miedo, gente!", "Denle like"],
    }),
    papel(F, "santiago", {
      rol: "Escucha las historias (y se asusta)",
      area: "jardin",
      tile: { x: 35, y: 69 },
      comportamiento: { tipo: "sentado", asiento: { x: 35, y: 69 } },
      charla: "fogata",
      pinta: { costume: "esqueleto", costumeGear: true },
      frases: { hola: ["Yo no me asusto. Bueno, un poquito.", "¿Aquí hay wifi? Necesito buscar si lo del reloj es verdad.", "Chepe dice que el cuidador anterior se fue por una puerta del sótano."] },
      murmullos: ["Yo no me asusté", "¿Oyeron eso?", "Mamá…"],
    }),
    papel(F, "aurelio", {
      rol: "Baila con Doña Carmenza",
      area: "jardin",
      tile: { x: 57, y: 45 },
      comportamiento: { tipo: "baila", mira: "right" },
      pinta: { costume: "vampiro", costumeGear: true },
      frases: { hola: ["Esta pieza es mía, Carmenza. Y la que sigue también.", "En mis tiempos la Noche de brujas se bailaba con capa.", "Vampiro, sí, pero bailador."] },
      murmullos: ["¡Eso, Carmenza!", "Un, dos, tres…", "¡Qué sabor!"],
    }),
    papel(F, "carmenza", {
      rol: "Baila con Don Aurelio",
      area: "jardin",
      tile: { x: 58, y: 45 },
      comportamiento: { tipo: "baila", mira: "left" },
      pinta: { costume: "bruja", costumeGear: true },
      frases: { hola: ["¡Aurelio, no me pise la capa!", "El disfraz lo cosí yo. El de Aurelio también, por eso le queda grande.", "Bruja, pero de las buenas."] },
      murmullos: ["¡Aurelio, no me pise!", "Esta sí me la sé", "¡Ay, qué rico!"],
    }),
    papel(F, "marina", {
      rol: "Cuenta la leyenda del cementerio de cartón",
      area: "jardin",
      tile: { x: 38, y: 130 },
      comportamiento: { tipo: "quieto", mira: "up" },
      pinta: { head: "witch-hat", accent: "#3a2a4a" },
      frases: {
        hola: ["Ese cementerio es de cartón, mijo. Pero la leyenda es de verdad.", "La lápida dice «Q.E.P.D. el lunes». Una broma de Chepe, no le haga caso.", "Antes la noche de brujas no se celebraba aquí. Ahora hasta yo me pongo sombrero."],
        noche: ["Dicen que a medianoche las calabazas se apagan solas. Yo nunca he visto la medianoche."],
      },
      murmullos: ["Eso no es así, mijo", "Cartón, pero respeto", "Qué juicio de lápidas"],
    }),
    papel(F, "fredy", {
      rol: "Cuida el camino disfrazado de superhéroe",
      area: "jardin",
      tile: { x: 62, y: 104 },
      comportamiento: { tipo: "ronda", paradas: [{ x: 62, y: 104, pausa: 1.5 }, { x: 62, y: 36, pausa: 1.5 }] },
      pinta: { costume: "superheroe", costumeGear: true },
      frases: { hola: ["Superhéroe de día, ciclista de madrugada.", "Del portón a la casa son ochenta pasos. Los conté tres veces.", "Con esta capa subo el alto más rápido. Eso creo."] },
      murmullos: ["¡Al rescate!", "Ochenta pasos…", "¿Alguien vio mi casco?"],
    }),
    papel(F, "efrain", {
      rol: "Vende empanadas de noche de brujas",
      area: "jardin",
      tile: { x: 56, y: 121 },
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: { head: "witch-hat", accent: "#e0752a" },
      frases: {
        hola: ["¡Empanadas de calabaza! Mentiras, son de papa. Pero con ají naranja.", "Las de esta noche salen con forma de murciélago. Más o menos."],
        tarde: ["Se me acabó el maíz para la masa. ¿Usted no tendrá unas mazorcas?"],
      },
      murmullos: ["¡Empanadas calienticas!", "Con ají de la casa", "¡Hay de murciélago!"],
      pedido: {
        id: "mazorcas-efrain",
        pide: [{ item: "mazorca", n: 2 }],
        da: { item: "empanada", n: 2 },
        texto: "Se me acabó el maíz para la masa. ¿Me trae dos mazorcas del huerto? Le pago con empanadas.",
        gracias: "¡Eso es maíz del bueno! Tenga, dos empanaditas calientes.",
      },
    }),
    papel(F, "ramiro", {
      rol: "Cuida la entrada del laberinto",
      area: "jardin",
      tile: { x: 49, y: 121 },
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: { head: "witch-hat", accent: "#4a3a2a" },
      frases: {
        hola: ["El maíz de ese laberinto lo sembré yo. Adentro hay una calabaza dorada, dicen.", "La tierra no tiene afán, y el laberinto tampoco. Entre con calma.", "Paloma, mi mula, se quedó en la casa. Le da miedo el disfraz."],
      },
      murmullos: ["Despacio, que es maíz", "La tierra no tiene afán", "Por la derecha, mijo"],
      pedido: {
        id: "fresas-ramiro",
        pide: [{ item: "fresa", n: 3 }],
        da: { item: "chupeta", n: 2 },
        texto: "Mi nieta quiere fresas para el disfraz de fresa. ¿Me trae tres del huerto? Le doy unas chupetas.",
        gracias: "Dios le pague. Tenga, que los dulces son pa' los que ayudan.",
      },
    }),
    // Adentro: Luz Dary ronda el recibidor esperando oír el reloj dar trece.
    papel(F, "luzdary", {
      rol: "Espera oír el reloj del recibidor",
      area: "planta-baja",
      tile: { x: 15, y: 18 },
      comportamiento: { tipo: "deambula", zona: { x: 12, y: 18, w: 6, h: 6 }, paradas: 4, pausa: 3 },
      pinta: { head: "witch-hat", accent: "#2a4a3a" },
      lluvia: "sigue",
      frases: { hola: ["Dicen que el reloj de pie da trece campanadas esta noche. Vine a comprobarlo.", "Los perros de la vereda están nerviosos. Algo pasa en esta casa.", "Si oye trece, me avisa, ¿sí?"] },
      murmullos: ["¿Fueron trece?", "Qué silencio…", "Ese reloj…"],
    }),
  ];
}
