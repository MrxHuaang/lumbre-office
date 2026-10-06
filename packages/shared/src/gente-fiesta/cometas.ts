// La gente del Festival de cometas (VIR-168): la tarde de agosto en la loma del observatorio. Los niños
// corren con sus cometas en el aire (la cometa de `cometa` vuela sobre ellos, en la misma capa que las de
// la gente), Chepe vende cometas y carretes en el puesto, Don Efraín pasa raspao y salpicón en su carrito,
// una familia hace picnic en el mantel, Canelo persigue las colas de las cometas detrás de Mariana, Don
// Ramiro hace de jurado junto al tablero del concurso y hay dos pedidos: la cometa de Mateo, enredada en el
// árbol (con un gancho), y la de Santiago, que quedó en el techo del garaje. Todo en tiles del jardín.
import type { FiestaNpc } from "../gente-fiesta";
import { COMETA_PERDIDA, COMETAS_CINE, GANCHO } from "../cometas";
import { canelo, hora, nino, papel, suelto } from "./comun";

const C = "cometas";

/** Las cometas de la gente (códigos de cometa.ts): forma, dos colores y cola. */
export const COMETAS_GENTE = {
  mariana: "psa1",
  sofi: "hmv2",
  mateo: "rnz2",
  santiago: "zzb3",
} as const;

/** El voladero (para los que pasean por la loma). */
const LOMA = { x: 112, y: 55, w: 18, h: 13 };

export function GENTE_COMETAS(): FiestaNpc[] {
  return [
    papel(C, "chepe", {
      rol: "Vende cometas y carretes",
      area: "jardin",
      tile: { x: 117, y: 52 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { head: "straw-hat", top: "flannel", shirt: "#c0392b" },
      accion: { tipo: "puesto" },
      lluvia: "sigue",
      frases: {
        hola: [
          "¡Lleve el papel de seda, los palitos y la cabuya! Con eso arma la suya en el taller de al lado.",
          "Una cometa de rombo no falla. La de pájaro sube más, pero se zarandea con cada ráfaga.",
          "Si se le enreda la cometa, lleve un gancho de alambre. Uno nunca sabe con estos árboles.",
        ],
        tarde: ["Esta es la hora buena: el viento de la tarde sube derechito desde el lago.", "Le cuento un chisme: el récord de hoy ya va alto. Dicen que con cola larga."],
        lluvia: ["Con este aguacero no se vuela nada. Guarde la cometa que el papel se deshace."],
      },
      murmullos: ["¡Cometas, carretes!", "Papel de seda, a la orden", "Hoy sopla bonito"],
    }),
    papel(C, "efrain", {
      rol: "Vende raspao y salpicón",
      area: "jardin",
      tile: { x: 124, y: 54 },
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: { head: "cap", outfit: "apron", shirt: "#f4f0e6" },
      accion: { tipo: "puesto" },
      lluvia: "sigue",
      frases: {
        hola: ["¡Raspao de mora con leche condensada! Pa' este solecito no hay nada mejor.", "El salpicón lo pico yo mismo: sandía, papaya, banano y su chorrito de naranja."],
        tarde: ["A esta hora se me acaba el hielo. Apúrele, que vuela más que las cometas."],
      },
      murmullos: ["¡Raspao, raspao!", "Salpicón bien frío", "Con leche condensada"],
    }),
    papel(C, "ramiro", {
      rol: "Jurado del concurso de cometas",
      area: "jardin",
      tile: { x: 121, y: 53 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { head: "straw-hat", neck: "neckerchief", accent: "#3a8ad0" },
      frases: {
        hola: [
          "Inscriba su cometa en el tablero y que voten todos. Yo solo cuido que nadie vote dos veces.",
          "La más alta la decide el viento. La más bonita, la gente. Así es más justo.",
          "De muchacho yo hacía cometas con papel periódico y engrudo de yuca. Volaban igualito.",
        ],
      },
      murmullos: ["Esa tiene buen color", "Un voto por cabeza", "Cola larga, vuelo calmado"],
    }),
    papel(C, "mariana", {
      rol: "Corre con su cometa",
      area: "jardin",
      tile: { x: 115, y: 57 },
      comportamiento: {
        tipo: "ronda",
        corre: true,
        paradas: [
          { x: 115, y: 57, pausa: 1.5 },
          { x: 125, y: 58, pausa: 1 },
          { x: 127, y: 65, pausa: 1.5 },
          { x: 116, y: 66, pausa: 1 },
        ],
      },
      pinta: { head: "bucket-hat", accent: "#ee7aa8" },
      cometa: COMETAS_GENTE.mariana,
      lleva: "carrete-cabuya",
      frases: {
        hola: ["¡Mira mi cometa! Es un pájaro y Canelo cree que es de verdad.", "Si corres contra el viento, sube solita. ¡Pruébalo!"],
        tarde: ["¡Ya casi llega a la nube esa! Bueno, casi casi."],
      },
      murmullos: ["¡Sube, sube!", "¡Canelo, suelta la cola!", "¡Más cabuya!"],
    }),
    canelo(C, `${C}:mariana`, { x: 114, y: 57 }, {
      rol: "Persigue las colas de las cometas",
      frases: { hola: ["¡Guau! Canelo salta tratando de morder la cola de la cometa.", "Canelo le trae un trapito de cola de cometa. Está todo babeado."] },
      murmullos: ["¡Guau!", "¡Guau, guau!", "¡Grrr… guau!"],
    }),
    suelto(C, "sofi", "Sofi", nino("#ffdbac", "#7a4a1a", { shirt: "#ee7aa8", hairStyle: "ponytail", pants: "#5a4a8a" }), {
      rol: "Corre con su cometa",
      area: "jardin",
      tile: { x: 114, y: 64 },
      comportamiento: {
        tipo: "ronda",
        corre: true,
        paradas: [
          { x: 114, y: 64, pausa: 1 },
          { x: 118, y: 67, pausa: 1.5 },
          { x: 126, y: 68, pausa: 1 },
          { x: 127, y: 56, pausa: 2 },
        ],
      },
      cometa: COMETAS_GENTE.sofi,
      lleva: "carrete-cabuya",
      voz: 0.86,
      frases: { hola: ["¡La mía es hexagonal! Mi abuelo me ayudó con los palitos.", "¿Viste que la cola larga hace que no dé tantas vueltas?"] },
      murmullos: ["¡Wiii!", "¡Allá va!", "¡No se me caigas!"],
    }),
    suelto(C, "mateo", "Mateo", nino("#c68642", "#2a1a10", { shirt: "#3a8ad0", head: "cap", accent: "#f2c84a" }), {
      rol: "Se le enredó la cometa",
      area: "jardin",
      tile: { x: 129, y: 61 },
      comportamiento: { tipo: "quieto", mira: "up" },
      cometa: COMETAS_GENTE.mateo,
      lleva: "carrete-cabuya",
      voz: 0.82,
      frases: {
        hola: ["Mi cometa se quedó enredada en ese árbol. Yo no alcanzo ni saltando.", "Mi mamá dice que no me suba a los árboles. Pero la cometa sí se subió."],
      },
      murmullos: ["Ay, mi cometa…", "Está altísima", "¿Y si la jalo?"],
      pedido: {
        id: "gancho-mateo",
        pide: [{ item: GANCHO, n: 1 }],
        da: { puntos: 8 },
        texto: "¿Tienes un gancho de alambre? Con eso sí la bajamos. Chepe los vende en el puesto de cometas.",
        gracias: "¡Ahí viene, ahí viene! ¡Está entera! Gracias, de verdad.",
        cine: COMETAS_CINE.rescate,
      },
    }),
    papel(C, "santiago", {
      rol: "Busca su cometa",
      area: "jardin",
      tile: { x: 124, y: 63 },
      comportamiento: { tipo: "quieto", mira: "up" },
      pinta: { head: "cap", accent: "#3a8ad0" },
      cometa: COMETAS_GENTE.santiago,
      lleva: "carrete-cabuya",
      frases: {
        hola: [
          "Se me reventó la cabuya y la cometa se fue volando hasta el techo del garaje. Al lado del garaje hay una escalera.",
          "Valentina dice que lo grabó todo. Qué oso.",
        ],
        tarde: ["¿Aquí hay wifi? Es que quiero mostrar la cometa… cuando la tenga."],
      },
      murmullos: ["Era mi cometa favorita", "¿Hay wifi aquí?", "Qué oso"],
      pedido: {
        id: "techo-santiago",
        pide: [{ item: COMETA_PERDIDA, n: 1 }],
        da: { puntos: 10 },
        texto: "¿Me la bajas del techo del garaje? Desde la escalera de al lado se alcanza. Yo te espero aquí.",
        gracias: "¡Mi cometa! Tiene un huequito, pero vuela. Te debo una.",
      },
    }),
    papel(C, "luzdary", {
      rol: "De picnic en la loma",
      area: "jardin",
      tile: { x: 120, y: 60 },
      comportamiento: { tipo: "sentado", asiento: { x: 120, y: 60 } },
      pinta: { head: "straw-hat", accent: "#e0a23a" },
      charla: "picnic",
      frases: { hola: ["Trajimos pandeyuca, pollo sudado y limonada. ¿Gusta un poquito?", "Desde aquí se ven todas las cometas. Es el mejor puesto de la loma."] },
      murmullos: ["¿Otro pandeyuca?", "Qué buen día", "Miren esa azul"],
    }),
    papel(C, "carmenza", {
      rol: "De picnic en la loma",
      area: "jardin",
      tile: { x: 122, y: 60 },
      comportamiento: { tipo: "sentado", asiento: { x: 122, y: 60 } },
      charla: "picnic",
      frases: { hola: ["El mantel lo bordé yo. Si se le cae limonada, me avisa.", "Las cometas de antes llevaban colas de trapitos de vestidos viejos. Las mías eran de tela fina."] },
      murmullos: ["Cuidado con el mantel", "En mis tiempos…", "¡Qué colores!"],
    }),
    papel(C, "aurelio", {
      rol: "De picnic en la loma",
      area: "jardin",
      tile: { x: 121, y: 61 },
      comportamiento: { tipo: "sentado", asiento: { x: 121, y: 61 } },
      charla: "picnic",
      frases: { hola: ["Yo elevé cometas desde la estación del tren. El maquinista me pitaba cuando pasaba.", "Si suena un bambuco, me paro a bailar. Aviso."] },
      murmullos: ["¡Eso, Carmenza!", "Qué brisa tan rica", "Yo bailo después"],
    }),
    papel(C, "tomas", {
      rol: "Toca el tiple junto al picnic",
      area: "jardin",
      tile: { x: 118, y: 61 },
      comportamiento: { tipo: "quieto", mira: "right" },
      frases: { hola: ["Le estoy componiendo un bambuco a las cometas. Se llama 'Cabuya al viento'.", "Con el viento de la loma, el tiple suena distinto. Más alegre."] },
      murmullos: ["Tlin, tlan…", "Cabuya al viento…", "Esta va pa' las cometas"],
    }),
    papel(C, "marina", {
      rol: "Conversa junto al carrito",
      area: "jardin",
      tile: { x: 123, y: 57 },
      comportamiento: { tipo: "grupo", grupo: "raspao", centro: { x: 124, y: 57 } },
      pinta: { head: "straw-hat", accent: "#3a9a5a" },
      frases: { hola: ["La cometa la trajeron los chinos hace siglos, y aquí la adoptamos en agosto, con los vientos.", "Agosto es el mes de las cometas en Colombia. Eso sí se lo enseñaba a mis alumnos."] },
      murmullos: ["En agosto, cometas", "Eso no es así", "Qué raspao tan rico"],
    }),
    papel(C, "rubiela", {
      rol: "Conversa junto al carrito",
      area: "jardin",
      tile: { x: 125, y: 57 },
      comportamiento: { tipo: "grupo", grupo: "raspao", centro: { x: 124, y: 57 } },
      frases: { hola: ["Yo vine por el raspao, no por las cometas. Bueno, por las dos.", "Mañana madrugo a hacer tamales, pero hoy me quedo hasta que se esconda el sol."] },
      murmullos: ["Uno de mora, Efraín", "¡Qué frío!", "Hasta que se esconda el sol"],
    }),
    papel(C, "valentina", {
      rol: "Graba las cometas",
      area: "jardin",
      tile: { x: 116, y: 59 },
      comportamiento: { tipo: "deambula", zona: LOMA, paradas: 6, pausa: 1.5 },
      fotos: true,
      frases: { hola: ["Estoy grabando un video de las cometas en cámara lenta. Va a quedar épico.", "Santiago perdió la cometa y yo lo grabé. Ya tiene más vistas que todo lo mío."] },
      murmullos: ["¡Grabando!", "Cámara lenta…", "Denle like"],
    }),
    papel(C, "fredy", {
      rol: "Mide el viento",
      area: "jardin",
      tile: { x: 126, y: 66 },
      comportamiento: { tipo: "deambula", zona: LOMA, paradas: 5, pausa: 2 },
      horario: { desde: hora(10), hasta: hora(19) },
      frases: {
        hola: ["El viento va a unos quince kilómetros por hora. Perfecto pa' cometa, pésimo pa' bicicleta.", "Mire la manga de viento: si está estirada, suelte la cometa sin miedo."],
      },
      murmullos: ["Quince kilómetros…", "Viento del oriente", "Ráfaga, ráfaga"],
    }),
  ];
}
