// La gente de la Noche de velitas (VIR-167): la familia que va prendiendo velitas en ronda por el camino del
// porche, el corrillo que reza en la explanada, los niños que corren con faroles, el señor de la natilla
// (con su pedido), el tiple en el muelle y los muchachos que graban los faroles. Chepe y Fredy chismosean en
// el recibidor. Todos de ruana o bien abrigados: es invierno.
import type { FiestaNpc } from "../gente-fiesta";
import { canelo, nino, papel, suelto } from "./comun";

const F = "velitas";
const RUBIELA = `${F}:rubiela`;
/** Las velitas del camino: la familia se agacha en cada grupito (izquierda al bajar, derecha al subir). */
const CAMINO = [
  { x: 61, y: 38, mira: "left", pausa: 2 },
  { x: 61, y: 54, mira: "left", pausa: 2 },
  { x: 61, y: 62, mira: "left", pausa: 2 },
  { x: 63, y: 62, mira: "right", pausa: 2 },
  { x: 63, y: 54, mira: "right", pausa: 2 },
  { x: 63, y: 38, mira: "right", pausa: 2 },
] as const;
const RUANA = (shirt: string, top2: string) => ({ outfit: "ruana" as const, shirt, top2 });

export function GENTE_VELITAS(): FiestaNpc[] {
  return [
    papel(F, "rubiela", {
      rol: "Prende velitas con su familia",
      area: "jardin",
      tile: { x: 61, y: 38 },
      comportamiento: { tipo: "ronda", paradas: CAMINO },
      pinta: RUANA("#a83a3a", "#e8c03a"),
      lleva: "velita",
      frases: {
        hola: ["Una velita por cada deseo, mijo. Yo llevo cuarenta y tres.", "Esta es por la cosecha, esta por la salud y esta… esa es secreta.", "Prenda la suya en el camino, que entre más, más bonito."],
        noche: ["Ahora sí se ven las velitas. Mire el camino, parece un río de luz."],
        lluvia: ["Con esta lluvia toca prenderlas debajo del alero. Pero se prenden."],
      },
      murmullos: ["Por la salud…", "Otra velita", "Que no se apague"],
    }),
    papel(F, "mariana", {
      rol: "Ayuda a prender las velitas",
      area: "jardin",
      tile: { x: 61, y: 39 },
      comportamiento: { tipo: "sigue", a: RUBIELA, distancia: 1.4 },
      pinta: { outfit: "coat", shirt: "#e05a7a", head: "pompom-beanie" },
      lleva: "velita",
      frases: { hola: ["Mi abuela Rubiela me deja prender las de abajo. ¡Ya prendí nueve!", "Le pedí a la velita que Canelo aprenda a sentarse. Ya casi.", "¿Usted qué deseo pidió? Yo no le cuento el mío."] },
      murmullos: ["¡Ya prendí nueve!", "¡Canelo, quieto!", "Qué bonito"],
    }),
    canelo(F, RUBIELA, { x: 61, y: 40 }, { comportamiento: { tipo: "sigue", a: RUBIELA, distancia: 2.6, corre: true } }),
    // El corrillo que reza en la explanada (se miran al centro y rezan por turnos).
    papel(F, "marina", {
      rol: "Dirige el rezo",
      area: "jardin",
      tile: { x: 69, y: 36 },
      comportamiento: { tipo: "grupo", grupo: "rezo", centro: { x: 70, y: 36 } },
      pinta: RUANA("#4a5a7a", "#d8d4ce"),
      farol: "velita",
      frases: { hola: ["Le rezamos a la Virgen por toda la vereda. Si quiere, únase.", "La noche de velitas se celebra desde que yo era niña. Y desde antes.", "Cada velita es una luz para alguien. Piense en a quién."] },
      murmullos: ["Dios te salve…", "Amén", "Bajito, por favor"],
    }),
    papel(F, "carmenza", {
      rol: "Reza con la profe",
      area: "jardin",
      tile: { x: 71, y: 36 },
      comportamiento: { tipo: "grupo", grupo: "rezo", centro: { x: 70, y: 36 } },
      pinta: RUANA("#7a2a46", "#f2c84a"),
      farol: "velita",
      frases: { hola: ["Estoy rezando por Aurelio, que se comió la natilla de todos.", "Esta ruana la tejí yo, en tres semanas. Pregúnteme el punto.", "Con una velita prendida, el frío se siente menos."] },
      murmullos: ["Amén", "Por Aurelio…", "Santa María…"],
    }),
    papel(F, "aurelio", {
      rol: "Reza (y cabecea)",
      area: "jardin",
      tile: { x: 70, y: 37 },
      comportamiento: { tipo: "grupo", grupo: "rezo", centro: { x: 70, y: 36 } },
      pinta: RUANA("#5a4a3a", "#c2a070"),
      farol: "velita",
      frases: { hola: ["Yo rezo, pero rezo mejor bailando.", "¿Ya le dieron natilla? A mí me la quitaron.", "En los ferrocarriles prendíamos velitas a lo largo de la carrilera. Llegaban hasta Girardot."] },
      murmullos: ["Amén…", "¿Ya acabamos?", "Zzz… ¡amén!"],
    }),
    suelto(F, "juanpis", "Juanpis", nino("#f1c27d", "#3a2418", { outfit: "coat", shirt: "#3a6ab0", head: "beanie" }), {
      rol: "Corre con su farol",
      area: "jardin",
      tile: { x: 58, y: 44 },
      comportamiento: { tipo: "deambula", zona: { x: 52, y: 40, w: 20, h: 16 }, paradas: 6, pausa: 0.6 },
      lleva: "farol-deseos",
      voz: 0.86,
      frases: { hola: ["¡Mire mi farol! Lo hice con papel de seda.", "A las nueve los soltamos todos en el lago. ¡El mío va a subir más!", "«No corra con el farol», dice mi mamá. Pero corriendo es más divertido."] },
      murmullos: ["¡Mire mi farol!", "¡Más rápido!", "¡Sofi, espéreme!"],
    }),
    suelto(F, "sofi", "Sofi", nino("#c68642", "#1b1b1b", { hairStyle: "braids", outfit: "coat", shirt: "#e8c03a", head: "pompom-beanie" }), {
      rol: "Corre con su farol",
      area: "jardin",
      tile: { x: 66, y: 50 },
      comportamiento: { tipo: "deambula", zona: { x: 52, y: 40, w: 20, h: 16 }, paradas: 6, pausa: 0.8 },
      lleva: "farol-deseos",
      voz: 0.95,
      frases: { hola: ["Mi farol es amarillo porque el amarillo da suerte.", "¿Usted ya escribió su deseo? Se escribe en el farol, en el muelle.", "Juanpis dice que el de él sube más. Mentira."] },
      murmullos: ["¡El mío sube más!", "¡Juanpis!", "Qué lucecitas"],
    }),
    papel(F, "efrain", {
      rol: "Vende natilla y buñuelos",
      area: "jardin",
      tile: { x: 57, y: 52 },
      comportamiento: { tipo: "quieto", mira: "right" },
      pinta: RUANA("#6a4a2a", "#e8d8b0"),
      frases: {
        hola: ["¡Natilla con canela y buñuelos calienticos! Hoy es noche de velitas.", "La natilla de mi mamá era mejor. La mía es la segunda mejor.", "Un buñuelo bien hecho se voltea solo en el aceite. Si no, se lo come uno mismo."],
        noche: ["A esta hora la natilla se acaba volando. Aproveche."],
      },
      murmullos: ["¡Natilla con canela!", "¡Buñuelos calienticos!", "Pruebe, que probar es gratis"],
      pedido: {
        id: "huevos-efrain",
        pide: [{ item: "huevo", n: 2 }],
        da: { item: "natilla", n: 1 },
        texto: "Se me acabaron los huevos para los buñuelos. ¿Me trae dos del gallinero? Le pago con natilla.",
        gracias: "¡Huevos criollos! Tenga su natilla, con canela y todo.",
      },
    }),
    papel(F, "tomas", {
      rol: "Toca el tiple en el muelle",
      area: "jardin",
      tile: { x: 76, y: 74 },
      comportamiento: { tipo: "quieto", mira: "right" },
      pinta: RUANA("#3a6a4a", "#d8a94a"),
      farol: "velita",
      frases: { hola: ["Toco bambucos para que los faroles suban contentos.", "Esta la compuse anoche: «Velita en el agua».", "Si me pide una, se la toco. Si es triste, mejor."] },
      murmullos: ["Tlin, tlan…", "Esta es «Velita…»", "Un bambuco suavecito"],
    }),
    papel(F, "valentina", {
      rol: "Graba los faroles",
      area: "jardin",
      tile: { x: 73, y: 72 },
      comportamiento: { tipo: "grupo", grupo: "muelle", centro: { x: 74, y: 72 } },
      pinta: { outfit: "coat", shirt: "#a07ad0", head: "pompom-beanie" },
      frases: { hola: ["Los faroles salen divinos en video. Párese ahí, que sale en la toma.", "Ya tengo trescientas fotos de velitas. Una es buena.", "Santi no sabe grabar derecho."] },
      murmullos: ["¡Qué toma!", "Otra vez, otra vez", "Salude a cámara"],
    }),
    papel(F, "santiago", {
      rol: "Le sostiene el celular a Valentina",
      area: "jardin",
      tile: { x: 75, y: 72 },
      comportamiento: { tipo: "grupo", grupo: "muelle", centro: { x: 74, y: 72 } },
      pinta: { outfit: "coat", shirt: "#3a3a4a", head: "beanie" },
      frases: { hola: ["Valen me tiene de trípode humano.", "¿Hay wifi en el muelle? Aquí no carga nada.", "Los faroles de deseos se sueltan en el muelle. Yo pedí wifi."] },
      murmullos: ["No carga…", "¿Así está bien?", "Valen, me cansé"],
    }),
    papel(F, "luzdary", {
      rol: "Camina hacia el lago con su farol",
      area: "jardin",
      tile: { x: 70, y: 60 },
      comportamiento: { tipo: "deambula", zona: { x: 66, y: 56, w: 10, h: 14 }, paradas: 5, pausa: 2 },
      pinta: RUANA("#2a6a6a", "#e8e4dc"),
      farol: "farol-deseos",
      frases: { hola: ["Los perros se asustan con la pólvora: en noche de velitas, mejor velitas que voladores.", "Mi deseo es que nadie tire pólvora este año.", "Ese farol lo suelto a las nueve, con todos."] },
      murmullos: ["Sin pólvora, por favor", "Qué noche tan linda", "Ya casi son las nueve"],
    }),
    papel(F, "ramiro", {
      rol: "Prende un farolito en el porche",
      area: "jardin",
      tile: { x: 66, y: 44 },
      comportamiento: { tipo: "quieto", mira: "down" },
      lleva: "velita",
      frases: {
        hola: ["Bajé de la loma con Paloma pa' ver las velitas. Allá arriba también prendemos.", "Esta noche hace un frío de páramo. Con un tinto se pasa."],
        noche: ["Mire pa' la loma: esas lucecitas son las velitas de mis vecinos."],
      },
      murmullos: ["Qué frío", "La tierra no tiene afán", "Un tintico…"],
      pedido: {
        id: "tinto-ramiro",
        pide: [{ item: "tinto", n: 1 }],
        da: { puntos: 8 },
        texto: "Con este frío de páramo… ¿no me trae un tinto de la cafetería? Se lo agradezco de corazón.",
        gracias: "¡Ay, calientico! Dios le pague, mijo.",
      },
    }),
    // Adentro: Chepe y Fredy chismosean junto a la escalera del recibidor.
    papel(F, "chepe", {
      rol: "Chismosea en el recibidor",
      area: "planta-baja",
      tile: { x: 16, y: 19 },
      comportamiento: { tipo: "grupo", grupo: "chisme", centro: { x: 17, y: 19 } },
      pinta: RUANA("#5a5a6a", "#e0923e"),
      lluvia: "sigue",
      frases: { hola: ["¿Ya supo? Dicen que Aurelio se comió la natilla de toda la novena. Y eso que no ha empezado.", "Le cuento algo, pero no diga que fui yo: la casera tiene una llave que nadie ha visto."] },
      murmullos: ["No diga que fui yo", "¿Ya supo?", "Venga le cuento"],
    }),
    papel(F, "fredy", {
      rol: "Escucha el chisme",
      area: "planta-baja",
      tile: { x: 18, y: 19 },
      comportamiento: { tipo: "grupo", grupo: "chisme", centro: { x: 17, y: 19 } },
      pinta: { outfit: "coat", shirt: "#e8c03a" },
      lluvia: "sigue",
      frases: { hola: ["Vine en la bici desde el alto con una velita en el manubrio. Llegó apagada.", "Chepe sabe todo de todos. Hasta mis tiempos en el alto."] },
      murmullos: ["¿En serio?", "¡No le creo!", "Cuarenta kilómetros"],
    }),
  ];
}
