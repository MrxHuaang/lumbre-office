// La gente del Carnaval de Negros y Blancos (VIR-167): el público en la vereda de la calle del Megabús, que
// baila y aplaude cuando pasa el desfile (a las 11, a las 3 y a las 7 del juego, `CARNAVAL.desfileHoras`),
// los vendedores de maicena (en el puesto) y de serpentinas (por la vereda; los dos abren el puesto), la niña
// con su máscara y los muchachos que graban. El blanco y negro va solo en la ropa y las máscaras: la piel de
// cada vecino es siempre la suya (`vestirVecino`).
import { CARNAVAL } from "../carnaval";
import type { FiestaNpc } from "../gente-fiesta";
import { canelo, hora, papel } from "./comun";

const F = "carnaval";
const BLANCO = "#f3f1ec";
const NEGRO = "#24212e";
/** Cuando pasa el desfile: el público se pone a bailar y aplaudir. */
const DESFILE = CARNAVAL.desfileHoras.map((h) => ({ desde: hora(h), hasta: hora(h) + CARNAVAL.ventanaMin + 15 }));
/** De blanco o de negro (camisa y pantalón), con algo de color. */
const DE = (shirt: string, pants: string, accent: string) => ({ shirt, pants, accent });

export function GENTE_CARNAVAL(): FiestaNpc[] {
  const publico = (frases: FiestaNpc["frases"], murmullos: readonly string[]) => ({
    comportamiento: { tipo: "quieto" as const, mira: "down" as const },
    fiestero: DESFILE,
    frases,
    murmullos,
  });
  return [
    papel(F, "efrain", {
      rol: "Vende maicena en el puesto",
      area: "jardin",
      tile: { x: 52, y: 128 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { ...DE(BLANCO, NEGRO, "#e0c03a"), head: "bandana" },
      accion: { tipo: "puesto" },
      lluvia: "sigue",
      frases: {
        hola: ["¡Maicena pa'l Día de Blancos! Pregunte antes de echarla, que no a todos les gusta.", "Bolsita de maicena, serpentinas y máscaras. ¿Qué se lleva?", "En Pasto el talco se echa con cariño. Aquí también."],
      },
      murmullos: ["¡Maicena, maicena!", "¡Serpentinas!", "Pregunte antes de echar"],
    }),
    papel(F, "rubiela", {
      rol: "Vende serpentinas por la vereda",
      area: "jardin",
      tile: { x: 40, y: 127 },
      comportamiento: { tipo: "ronda", paradas: [{ x: 40, y: 127, mira: "down", pausa: 2 }, { x: 80, y: 127, mira: "down", pausa: 2 }] },
      pinta: { ...DE(NEGRO, BLANCO, "#e05a7a"), outfit: "apron" },
      accion: { tipo: "puesto" },
      frases: { hola: ["¡Serpentinas de colores! Pa' tirarle a los de la comparsa.", "Vendo por la vereda pa' que nadie se quede sin su serpentina."] },
      murmullos: ["¡Serpentinas!", "¡De colores!", "Lleve, lleve"],
    }),
    papel(F, "aurelio", {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 68, y: 128 },
      ...publico({ hola: ["Desde los ferrocarriles no me pierdo un carnaval. Esta es la mejor vereda pa' verlo.", "Cuando pase la carroza del cóndor, aplauda duro."] }, ["¡Que viva el carnaval!", "¡Ahí viene!", "¡Bravo!"]),
      pinta: { costume: "arlequin-pastuso", costumeGear: true },
    }),
    papel(F, "carmenza", {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 69, y: 128 },
      ...publico({ hola: ["El traje me lo cosí yo: blanco y negro, como manda la tradición.", "¿Ya votó en el concurso de disfraces? Yo voté por mí. Se puede, ¿no?"] }, ["¡Qué carrozas!", "¡Aurelio, baile!", "¡Viva Pasto!"]),
      pinta: { ...DE(BLANCO, NEGRO, "#e05a7a"), outfit: "dress", face: "carnival-mask" },
      pedido: {
        id: "clavel-carmenza",
        pide: [{ item: "clavel", n: 1 }],
        da: { puntos: 8 },
        texto: "A mi sombrero de carnaval le falta una flor. ¿Me trae un clavel del huerto?",
        gracias: "¡Ahora sí estoy completa! Gracias, mijo, quedé de concurso.",
      },
    }),
    papel(F, "marina", {
      rol: "Explica el carnaval",
      area: "jardin",
      tile: { x: 72, y: 128 },
      ...publico(
        { hola: ["El Carnaval de Negros y Blancos es patrimonio de la humanidad, mijo. Desde 2009.", "El Día de Negros recuerda un día de libertad. Por eso se celebra con respeto y con alegría."] },
        ["Patrimonio, mijo", "Con respeto y alegría", "¡Bravo, bravo!"],
      ),
      pinta: { ...DE(NEGRO, BLANCO, "#e0c03a"), head: "party-hat" },
    }),
    papel(F, "chepe", {
      rol: "Comenta el desfile",
      area: "jardin",
      tile: { x: 75, y: 128 },
      ...publico({ hola: ["La carroza del Megabús la armaron en mi taller. No diga nada.", "¿Ya supo quién va ganando el concurso? Venga le cuento."] }, ["¡Esa la armé yo!", "¿Ya supo?", "¡Uy, qué carroza!"]),
      pinta: { costume: "comparsa-blanca", costumeGear: true },
    }),
    papel(F, "luzdary", {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 110, y: 128 },
      ...publico({ hola: ["Vine a ver las carrozas. Y a cuidar que nadie le eche maicena a los perros.", "Qué bonito el cóndor de la carroza. Bien hecho, con plumas de papel."] }, ["¡Qué belleza!", "¡Ahí viene el cóndor!", "Sin maicena al perro"]),
      pinta: { ...DE(BLANCO, NEGRO, "#4ab0a0"), face: "carnival-mask" },
    }),
    papel(F, "fredy", {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 112, y: 128 },
      ...publico({ hola: ["Vine en bici desde el alto pa' ver el desfile. Diecisiete kilómetros.", "Las carrozas van a dos kilómetros por hora. Yo las paso caminando."] }, ["¡Eso, eso!", "¡Que viva!", "¡Más rápido, cóndor!"]),
      pinta: DE(NEGRO, BLANCO, "#e8c03a"),
    }),
    papel(F, "ramiro", {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 115, y: 128 },
      ...publico({ hola: ["Paloma, mi mula, se quedó amarrada. Le da susto la pólvora y las carrozas.", "La tierra no tiene afán. El desfile tampoco: ahí viene despacito."] }, ["¡Viva!", "Despacito viene", "¡Bravo!"]),
      pinta: { shirt: BLANCO, top2: NEGRO },
    }),
    papel(F, "tomas", {
      rol: "Toca la guaneña en la vereda",
      area: "jardin",
      tile: { x: 120, y: 128 },
      ...publico({ hola: ["La guaneña es el himno del carnaval. La toco hasta dormido.", "Esta la compuse anoche: una guaneña con tiple. Escuche."] }, ["Guaneña, guaneñita…", "¡Que suene!", "Tlin, tlan, tlin"]),
      pinta: { shirt: BLANCO, top2: NEGRO, head: "party-hat", accent: NEGRO },
      pedido: {
        id: "tinto-tomas",
        pide: [{ item: "tinto", n: 1 }],
        da: { item: "serpentinas", n: 2 },
        texto: "Llevo toda la mañana tocando la guaneña y se me secó la garganta. ¿Me trae un tinto?",
        gracias: "¡Ese tintico revive a cualquiera! Tenga unas serpentinas pa'l desfile.",
      },
    }),
    papel(F, "mariana", {
      rol: "Corre con su máscara",
      area: "jardin",
      tile: { x: 70, y: 124 },
      comportamiento: { tipo: "deambula", zona: { x: 60, y: 120, w: 20, h: 8 }, paradas: 5, pausa: 0.8 },
      pinta: { ...DE(BLANCO, NEGRO, "#e05a7a"), face: "carnival-mask" },
      fiestero: DESFILE,
      frases: { hola: ["¡Mire mi máscara! La pinté yo: un lado blanco y otro negro.", "Canelo no quiere máscara. Dice que él ya es bonito."] },
      murmullos: ["¡Mire mi máscara!", "¡Canelo, baile!", "¡Ahí viene!"],
    }),
    canelo(F, `${F}:mariana`, { x: 69, y: 124 }),
    papel(F, "valentina", {
      rol: "Graba el desfile",
      area: "jardin",
      tile: { x: 106, y: 126 },
      comportamiento: { tipo: "grupo", grupo: "graban", centro: { x: 107, y: 126 } },
      fiestero: DESFILE,
      pinta: { ...DE(BLANCO, NEGRO, "#a07ad0"), face: "carnival-mask" },
      fotos: true,
      frases: { hola: ["¡En vivo desde el carnaval! Párese al lado, que sale en la toma.", "Si la comparsa me echa maicena, el celular sobrevive. Ya lo probé."] },
      murmullos: ["¡En vivo!", "¡Qué toma!", "Salude, salude"],
    }),
    papel(F, "santiago", {
      rol: "Graba el desfile",
      area: "jardin",
      tile: { x: 108, y: 126 },
      comportamiento: { tipo: "grupo", grupo: "graban", centro: { x: 107, y: 126 } },
      fiestero: DESFILE,
      pinta: DE(NEGRO, BLANCO, "#e05a3a"),
      fotos: true,
      frases: { hola: ["Valen me pidió que grabe de lado. Yo grabo de lado.", "¿Hay wifi en la calle? Pa' subir el video ya."] },
      murmullos: ["¿Hay wifi?", "Grabando…", "¡Ahí viene!"],
    }),
  ];
}
