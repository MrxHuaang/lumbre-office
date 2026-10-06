// La gente del Carnaval de Negros y Blancos (VIR-167, VIR-173): el público del Desfile Magno en la vereda de
// la calle del Megabús, de punta a punta: los vecinos en su papel de carnaval y gente suelta de la vereda.
// Hay quien guarda puesto en primera fila (y baila y aplaude cuando pasa el desfile, `fiestero`), familias
// en corrillo, niños que corren por la vereda, vendedores ambulantes de espuma, talco y gorros que caminan
// de punta a punta, los mayores sentados en la banca del sendero, quien toma fotos y los vendedores de
// maicena (en el puesto) y de serpentinas (los dos abren el puesto). Todo de día: el Carnaval no tiene
// gente de noche (llegan a la apertura y se van antes de las 19:00). El blanco y negro va solo en la ropa,
// las máscaras y el talco sobre la cara (`talco`, un polvito encima): la piel de cada uno es siempre la suya
// (`vestirVecino`). El sitio es solo una guía: el mapa corre a cada uno al tile libre más cercano.
import { CARNAVAL } from "../carnaval";
import type { FiestaNpc } from "../gente-fiesta";
import type { Look } from "../look";
import { canelo, hora, nino, papel, suelto } from "./comun";

const F = "carnaval";
const BLANCO = "#f3f1ec";
const NEGRO = "#24212e";
/** Cuando pasa el desfile: el público se pone a bailar y aplaudir (solo los de día). */
const DESFILE = CARNAVAL.desfileHoras.filter((h) => h < 19).map((h) => ({ desde: hora(h), hasta: hora(h) + CARNAVAL.ventanaMin + 15 }));
/** De la apertura hasta antes de que oscurezca: de noche no queda nadie. */
const DE_DIA = { desde: hora(9), hasta: hora(18, 30) } as const;
/** Los niños se van un poco antes. */
const NINOS = { desde: hora(9, 20), hasta: hora(17, 40) } as const;
/** Por donde llega la gente: el sendero que baja del portón. */
const SENDERO = { x: 62, y: 116 } as const;
/** La fila de adelante de la vereda (pegada al cordón de la calle) y la de atrás. */
const ADELANTE = 131;
const ATRAS = 130;
/** De blanco o de negro (camisa y pantalón), con algo de color. */
const DE = (shirt: string, pants: string, accent: string) => ({ shirt, pants, accent });

/** Una persona de la vereda que no es de los vecinos: adulto con pinta completa. */
const adulto = (skin: string, hair: string, l: Partial<Omit<Look, "accessories" | "skin" | "hair">>): Omit<Look, "accessories"> => ({
  skin,
  hair,
  shirt: BLANCO,
  pants: NEGRO,
  accent: "#e0c03a",
  hairStyle: "short",
  top: "longsleeve",
  bottom: "pants",
  shoes: "boots",
  shoeColor: "#2a1a10",
  ...l,
});

export function GENTE_CARNAVAL(): FiestaNpc[] {
  /** En primera fila, mirando a la calle, bailando cuando pasa el desfile. */
  const publico = (frases: FiestaNpc["frases"], murmullos: readonly string[]) => ({
    comportamiento: { tipo: "quieto" as const, mira: "down" as const },
    horario: DE_DIA,
    fiestero: DESFILE,
    frases,
    murmullos,
  });
  /** En corrillo con los suyos (familia o amigos), bailando cuando pasa el desfile. */
  const corrillo = (grupo: string, centro: { x: number; y: number }) => ({
    comportamiento: { tipo: "grupo" as const, grupo, centro },
    horario: DE_DIA,
    fiestero: DESFILE,
  });

  return [
    // ---------- Los del puesto y los vendedores ambulantes ----------
    papel(F, "efrain", {
      rol: "Vende maicena en el puesto",
      area: "jardin",
      tile: { x: 52, y: 128 },
      comportamiento: { tipo: "quieto", mira: "down" },
      horario: DE_DIA,
      pinta: { ...DE(BLANCO, NEGRO, "#e0c03a"), head: "bandana" },
      accion: { tipo: "puesto" },
      lluvia: "sigue",
      frases: {
        hola: [
          "¡Maicena pa'l Día de Blancos! Pregunte antes de echarla, que no a todos les gusta.",
          "Bolsita de maicena, serpentinas y máscaras. ¿Qué se lleva?",
          "En Pasto el talco se echa con cariño y preguntando primero. Aquí también.",
        ],
        manana: ["Madrugue al puesto, que a las once ya no cabe nadie en la vereda."],
        tarde: ["Ya casi no me queda maicena. Esta vereda está más llena que nunca."],
      },
      murmullos: ["¡Maicena, maicena!", "¡Serpentinas!", "Pregunte antes de echar"],
    }),
    papel(F, "rubiela", {
      rol: "Vende serpentinas por la vereda",
      area: "jardin",
      tile: { x: 104, y: ATRAS },
      comportamiento: {
        tipo: "ronda",
        paradas: [
          { x: 104, y: ATRAS, mira: "down", pausa: 2 },
          { x: 120, y: ATRAS, mira: "down", pausa: 1.5 },
          { x: 138, y: ATRAS, mira: "down", pausa: 2 },
          { x: 120, y: ATRAS, mira: "down", pausa: 1.5 },
        ],
      },
      horario: DE_DIA,
      pinta: { ...DE(NEGRO, BLANCO, "#e05a7a"), outfit: "apron" },
      accion: { tipo: "puesto" },
      lleva: "serpentinas",
      frases: { hola: ["¡Serpentinas de colores! Pa' tirárselas a la comparsa.", "Vendo por la vereda pa' que nadie se quede sin su serpentina."] },
      murmullos: ["¡Serpentinas!", "¡De colores!", "Lleve, lleve"],
    }),
    suelto(F, "wilson", "Wilson", adulto("#c68642", "#1f1a16", { shirt: BLANCO, pants: NEGRO, accent: "#3a6a3a", top: "dress-shirt", outfit: "vest", head: "straw-hat" }), {
      rol: "Vende espuma por la vereda",
      area: "jardin",
      tile: { x: 16, y: ATRAS },
      comportamiento: {
        tipo: "ronda",
        paradas: [
          { x: 16, y: ATRAS, mira: "down", pausa: 1.5 },
          { x: 32, y: ATRAS, mira: "down", pausa: 1 },
          { x: 48, y: ATRAS, mira: "down", pausa: 1.5 },
          { x: 32, y: ATRAS, mira: "down", pausa: 1 },
        ],
      },
      horario: DE_DIA,
      frases: {
        hola: [
          "¡Espuma de carnaval, a la orden! Pero a usted no le echo sin preguntarle, tranquilo.",
          "La espuma es pa' jugar con los amigos, no pa' los mayores ni pa' los perros.",
        ],
        tarde: ["Ya vendí media caja. El desfile de las once dejó a todo el mundo blanquito."],
      },
      murmullos: ["¡Espuma, espuma!", "¡A la orden la espuma!", "Lleve su tarrito"],
    }),
    suelto(F, "yolanda", "Doña Yolanda", adulto("#e0ac69", "#3a2418", { shirt: "#6a3a9a", top2: "#e8c03a", pants: "#6a3a9a", accent: BLANCO, hairStyle: "bun", outfit: "ruana", head: "bandana", bottom: "long-skirt", shoes: "sandals", shoeColor: "#6a4a2a" }), {
      rol: "Vende talco por la vereda",
      area: "jardin",
      tile: { x: 66, y: ATRAS },
      comportamiento: {
        tipo: "ronda",
        paradas: [
          { x: 66, y: ATRAS, mira: "down", pausa: 1.5 },
          { x: 82, y: ATRAS, mira: "down", pausa: 2 },
          { x: 66, y: ATRAS, mira: "down", pausa: 1 },
          { x: 50, y: 128, mira: "down", pausa: 1.5 },
        ],
      },
      horario: DE_DIA,
      talco: true,
      lleva: "maicena",
      frases: {
        hola: [
          "Talquito, mijo, talquito. El de verdad, el del Día de Blancos.",
          "Mire cómo quedé de tanto vender talco. Así se sabe que es bueno.",
        ],
      },
      murmullos: ["¡Talquito, talquito!", "Me echaron talco, ve", "Bolsita a la orden"],
    }),
    suelto(F, "libardo", "Don Libardo", adulto("#c8946a", "#8a8680", { shirt: "#7a2a36", top2: "#e8c03a", pants: "#3a3030", accent: "#3a8a4a", outfit: "ruana", head: "pompom-beanie", facialHair: "mustache" }), {
      rol: "Vende máscaras y gorros",
      lleva: "antifaz-carnaval",
      area: "jardin",
      tile: { x: 106, y: 128 },
      comportamiento: {
        tipo: "ronda",
        paradas: [
          { x: 106, y: 128, mira: "down", pausa: 2 },
          { x: 124, y: 128, mira: "down", pausa: 1.5 },
          { x: 138, y: 128, mira: "down", pausa: 2 },
          { x: 124, y: 128, mira: "down", pausa: 1.5 },
        ],
      },
      horario: DE_DIA,
      frases: {
        hola: [
          "Gorros de lana de oveja, tejidos en Obonuco. Pa'l frío de la tarde, sumercé.",
          "Máscaras de papel maché y gorros de pompón. El de pompón se ve desde lejos en el desfile.",
        ],
      },
      murmullos: ["¡Máscaras y gorros!", "¡Achichay, qué frío!", "Tejidos a mano"],
    }),

    // ---------- Al oeste: la familia, los niños que corren y la primera fila ----------
    suelto(F, "papa-ortiz", "Don Hernando", adulto("#d9a066", "#2a2420", { shirt: "#8a3a2a", top2: "#e8a03a", pants: "#3a3030", outfit: "ruana", head: "fedora", facialHair: "stubble" }), {
      rol: "Vino con la familia",
      area: "jardin",
      tile: { x: 19, y: ADELANTE },
      ...corrillo("ortiz", { x: 20, y: ATRAS }),
      llega: SENDERO,
      frases: {
        hola: [
          "Venimos todos los años desde Ipiales. Los niños no duermen la noche antes.",
          "A mi papá le tocó desfilar con la carroza del cóndor. Ahora traigo a los míos.",
        ],
      },
      murmullos: ["¡Mijos, no se suelten!", "Ya se oye la banda", "¡Viva el Carnaval!"],
      charla: "ortiz",
    }),
    suelto(F, "mama-ortiz", "Doña Gladys", adulto("#c68642", "#1b1b1b", { shirt: BLANCO, pants: NEGRO, hairStyle: "braids", head: "flower", accent: "#e05a7a", bottom: "long-skirt", neck: "necklace", shoes: "dress-shoes" }), {
      rol: "Vino con la familia",
      area: "jardin",
      tile: { x: 21, y: ADELANTE },
      ...corrillo("ortiz", { x: 20, y: ATRAS }),
      llega: SENDERO,
      frases: {
        hola: [
          "Guardamos puesto desde las nueve. Aquí se ve todo, hasta las caras de las máscaras.",
          "Le tejí la ruana a mi marido para hoy. Y la blusa la bordé yo, con flores de colores.",
        ],
      },
      murmullos: ["¡Qué carroza tan bonita!", "Tápese, que hace frío", "¡Ananay, qué bonito!"],
    }),
    suelto(F, "nina-ortiz", "Isabela", nino("#c68642", "#1b1b1b", { shirt: BLANCO, pants: NEGRO, accent: "#c04a8a", hairStyle: "braids", head: "pompom-beanie", top: "longsleeve", bottom: "skirt", shoes: "dress-shoes", shoeColor: NEGRO }), {
      rol: "Vino con la familia",
      area: "jardin",
      tile: { x: 20, y: 129 },
      ...corrillo("ortiz", { x: 20, y: ATRAS }),
      horario: NINOS,
      llega: SENDERO,
      voz: 0.94,
      frases: { hola: ["¡Mi papá dice que la carroza del cóndor mueve las alas! ¿Tú ya la viste?", "Mi abuelita me tejió el gorro de pompón. ¡Es el más bonito de la vereda!"] },
      murmullos: ["¡Ahí viene, ahí viene!", "¡Papi, alcéme!", "¡Qué máscara tan linda!"],
    }),
    suelto(F, "juancho", "Juancho", nino("#8d5524", "#1b1b1b", { shirt: "#8a5a3a", top2: "#e8c03a", pants: "#3a5a8a", accent: "#e8c03a", outfit: "ruana", face: "carnival-mask", shoes: "sandals", shoeColor: "#6a4a2a" }), {
      rol: "Corre por la vereda",
      area: "jardin",
      tile: { x: 24, y: ADELANTE },
      comportamiento: {
        tipo: "ronda",
        corre: true,
        paradas: [
          { x: 24, y: ADELANTE, mira: "right", pausa: 0.6 },
          { x: 44, y: ATRAS, mira: "down", pausa: 0.8 },
          { x: 36, y: 128, mira: "left", pausa: 0.5 },
        ],
      },
      horario: NINOS,
      talco: true,
      voz: 0.9,
      frases: { hola: ["¡No me alcanzas! ¡Soy más rápido que la carroza del Megabús!", "Me echaron talco y quedé como un fantasmita. ¡Uuuh!"] },
      murmullos: ["¡No me alcanzas!", "¡Uuuh, fantasma!", "¡Sara, por acá!"],
    }),
    suelto(F, "sara", "Sara", nino("#e0ac69", "#6a3a1a", { shirt: BLANCO, pants: NEGRO, accent: "#e05a7a", hairStyle: "ponytail", head: "flower", top: "longsleeve", bottom: "skirt", shoes: "dress-shoes", shoeColor: NEGRO }), {
      rol: "Corre detrás de Juancho",
      area: "jardin",
      tile: { x: 23, y: ADELANTE },
      comportamiento: { tipo: "sigue", a: `${F}:juancho`, distancia: 1.4, corre: true },
      horario: NINOS,
      voz: 0.96,
      frases: { hola: ["¡Juancho, espérame! ¡Siempre hace trampa!", "Cuando pase la comparsa me voy a poner a bailar como ellos."] },
      murmullos: ["¡Juancho, espérame!", "¡Te alcanzo, te alcanzo!"],
    }),
    suelto(F, "jesus", "Don Jesús", adulto("#c8946a", "#d8d4ce", { shirt: "#7a4a2a", top2: "#c0392b", pants: "#3a3030", accent: "#24212e", outfit: "ruana", head: "fedora", facialHair: "mustache" }), {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 34, y: ADELANTE },
      ...publico(
        {
          hola: [
            "Yo vi el primer desfile de carrozas, cuando era un guambrito. Desde entonces no me pierdo uno.",
            "El carnaval se goza con respeto, mijo. Cada máscara tiene su trabajo detrás.",
          ],
          tarde: ["Ya me duelen las piernas, pero de aquí no me mueve nadie hasta que pase la última carroza."],
        },
        ["Así era en mis tiempos", "¡Bravo, muchachos!", "¡Achichay, qué frío!"],
      ),
      llega: SENDERO,
    }),
    suelto(F, "rosario", "Doña Rosario", adulto("#e0ac69", "#b8b2ac", { shirt: NEGRO, top2: "#7a4ab0", pants: NEGRO, hairStyle: "bun", outfit: "ruana", head: "pompom-beanie", accent: "#7a4ab0", bottom: "long-skirt" }), {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 36, y: ADELANTE },
      ...publico(
        {
          hola: [
            "Traje termo de café y pan de maíz. Siéntese un ratico si quiere, que esto va pa' largo.",
            "La comparsa de mi nieta pasa con la carroza de la Minga. ¡Me avisa si la ve!",
          ],
        },
        ["¿Ya viene el desfile?", "¡Qué belleza!", "Ahí va mi nieta"],
      ),
      charla: "primera-fila",
    }),
    suelto(F, "nicolas", "Nicolás", nino("#a86b3c", "#2a1810", { shirt: BLANCO, pants: NEGRO, accent: "#e05a3a", top: "hoodie" }), {
      rol: "Perdió su máscara",
      area: "jardin",
      tile: { x: 46, y: ADELANTE },
      comportamiento: { tipo: "quieto", mira: "down" },
      horario: NINOS,
      fiestero: DESFILE,
      voz: 0.88,
      frases: {
        hola: ["Se me cayó la máscara en el desfile y la pisó la comparsa. Ya no tengo pa' hacer de comparsero.", "Mi mamá dice que en el puesto venden máscaras, pero no me alcanza."],
      },
      murmullos: ["Mi máscara…", "¿Usted vio mi máscara?", "¡Ahí viene la banda!"],
      pedido: {
        id: "antifaz-nicolas",
        pide: [{ item: "antifaz-carnaval", n: 1 }],
        da: { puntos: 10 },
        texto: "¿Me traes un antifaz del puesto de Don Efraín? Así vuelvo a ser comparsero.",
        gracias: "¡Gracias, gracias! Ahora sí: ¡que viva el Carnaval! Mi papá me dio esto pa' ti.",
      },
    }),

    // ---------- Donde el sendero llega a la vereda (el portón) ----------
    papel(F, "ramiro", {
      rol: "Mira el desfile desde la banca",
      area: "jardin",
      tile: { x: 54, y: 127 },
      comportamiento: { tipo: "sentado", asiento: { x: 54, y: 127 } },
      horario: DE_DIA,
      pinta: { shirt: BLANCO, top2: NEGRO, head: "straw-hat" },
      frases: {
        hola: ["Paloma, mi mula, se quedó amarrada. Le dan susto la pólvora y las carrozas.", "La tierra no tiene afán. El desfile tampoco: ahí viene despacito."],
      },
      murmullos: ["Despacito viene", "¡Viva!", "Buen puesto, este"],
      charla: "banca",
    }),
    suelto(F, "teresa", "Doña Teresa", adulto("#d9a066", "#ece8e2", { shirt: NEGRO, top2: BLANCO, pants: NEGRO, hairStyle: "curly", outfit: "ruana", head: "beanie", accent: BLANCO, bottom: "long-skirt", face: "round-glasses" }), {
      rol: "Mira el desfile desde la banca",
      area: "jardin",
      tile: { x: 54, y: 128 },
      comportamiento: { tipo: "sentado", asiento: { x: 54, y: 128 } },
      horario: DE_DIA,
      frases: {
        hola: [
          "Ya no estoy pa' pararme toda la tarde, pero de aquí veo pasar todo. Ramiro me guardó la banca.",
          "Mi abuelo desfilaba el 5 de enero, el Día de Negros. Era un día de libertad y de alegría, me decía.",
        ],
      },
      murmullos: ["Mi abuelo desfilaba", "¡Qué colores!", "Con respeto y alegría"],
      charla: "banca",
    }),
    papel(F, "marina", {
      rol: "Explica el carnaval",
      area: "jardin",
      tile: { x: 57, y: ADELANTE },
      ...publico(
        {
          hola: [
            "El Carnaval de Negros y Blancos es patrimonio de la humanidad desde 2009. Eso se lo pregunto en el examen.",
            "El Día de Negros recuerda un día de libertad. Por eso se celebra con respeto y con alegría.",
            "Las carrozas son de papel maché: los artesanos trabajan todo el año para este día.",
          ],
        },
        ["Patrimonio de la humanidad", "Con respeto y alegría", "¡Bravo, bravo!"],
      ),
      pinta: { ...DE(NEGRO, BLANCO, "#e0c03a"), head: "party-hat" },
    }),
    papel(F, "aurelio", {
      rol: "Baila en la vereda",
      area: "jardin",
      tile: { x: 63, y: ADELANTE },
      ...publico({ hola: ["Desde los ferrocarriles no me pierdo un carnaval. Esta es la mejor vereda pa' verlo.", "Cuando pase la carroza del cóndor, aplauda duro."] }, ["¡Que viva el Carnaval!", "¡Ahí viene!", "Esta pieza es mía"]),
      pinta: { costume: "arlequin-pastuso", costumeGear: true },
      charla: "pareja",
    }),
    papel(F, "carmenza", {
      rol: "Baila en la vereda",
      area: "jardin",
      tile: { x: 64, y: ADELANTE },
      ...publico({ hola: ["El traje me lo cosí yo: blanco y negro, como manda la tradición.", "¿Ya votó en el concurso de disfraces? Yo voté por mí. Se puede, ¿no?"] }, ["¡Aurelio, no me pise!", "¡Qué carrozas!", "¡Viva Pasto!"]),
      pinta: { ...DE(BLANCO, NEGRO, "#e05a7a"), outfit: "dress", face: "carnival-mask" },
      charla: "pareja",
      pedido: {
        id: "empanada-carmenza",
        pide: [{ item: "empanada", n: 1 }],
        da: { puntos: 8 },
        texto: "Llevo desde las nueve guardando puesto y no he desayunado. ¿Me trae una empanadita de la cafetería?",
        gracias: "¡Ay, bendito sea! Con esto aguanto hasta la última carroza. Mil gracias.",
      },
    }),

    // ---------- Antes de la estación ----------
    papel(F, "chepe", {
      rol: "Comenta el desfile",
      area: "jardin",
      tile: { x: 70, y: ADELANTE },
      ...publico({ hola: ["La carroza del Megabús la armaron en mi taller. No diga nada.", "¿Ya supo quién va ganando el concurso? Venga le cuento."] }, ["¡Esa la armé yo!", "¿Ya supo?", "¡Uy, qué carroza!"]),
      pinta: { costume: "comparsa-blanca", costumeGear: true },
      talco: true,
      charla: "comadres",
    }),
    papel(F, "luzdary", {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 72, y: ADELANTE },
      ...publico({ hola: ["Vine a ver las carrozas. Y a cuidar que nadie le eche maicena a los perros.", "Qué bonito el cóndor de la carroza. Bien hecho, con plumas de papel."] }, ["¡Qué belleza!", "Ahí viene la del cóndor", "Sin maicena al perro"]),
      pinta: { ...DE(BLANCO, NEGRO, "#4ab0a0"), face: "carnival-mask", head: "pompom-beanie" },
      charla: "comadres",
    }),
    suelto(F, "fanny", "Doña Fanny", adulto("#8d5524", "#2a2420", { shirt: "#2a7a4a", top2: "#e8c03a", pants: NEGRO, hairStyle: "afro", outfit: "ruana", head: "flower", accent: "#e05a7a", bottom: "long-skirt" }), {
      rol: "Vino con el nieto",
      area: "jardin",
      tile: { x: 76, y: ADELANTE },
      ...corrillo("guerrero", { x: 77, y: ATRAS }),
      llega: SENDERO,
      frases: {
        hola: [
          "Este es mi nieto Arturo: primera vez que ve el carnaval. Mírele la cara, no cree lo que ve.",
          "En mi casa el 5 de enero era fiesta grande. Mi abuela decía que es el día de la libertad, y que se goza bailando.",
        ],
      },
      murmullos: ["¡Mire, mijo, mire!", "¡Qué carroza tan bonita!", "¡Viva el Carnaval!"],
    }),
    suelto(F, "arturo", "Arturito", nino("#8d5524", "#1b1b1b", { shirt: "#e8dcc0", top2: "#3a5ab0", pants: "#3a3030", accent: "#c0392b", head: "pompom-beanie", outfit: "ruana" }), {
      rol: "Ve su primer carnaval",
      area: "jardin",
      tile: { x: 78, y: ADELANTE },
      ...corrillo("guerrero", { x: 77, y: ATRAS }),
      horario: NINOS,
      llega: SENDERO,
      voz: 0.97,
      frases: { hola: ["¡El cóndor es más grande que mi casa!", "Abuela, ¿me compra serpentinas? ¡Porfa, porfa!"] },
      murmullos: ["¡Abuela, mire!", "¡Es gigante!", "¡Otra, otra!"],
    }),
    suelto(F, "hernan", "Hernán", adulto("#ffdbac", "#6a3a1a", { shirt: "#3a8a3a", top2: "#e8c03a", pants: "#3a4a6a", accent: "#c0392b", outfit: "ruana", head: "pompom-beanie" }), {
      rol: "Toma fotos del desfile",
      area: "jardin",
      tile: { x: 80, y: 128 },
      comportamiento: { tipo: "deambula", zona: { x: 66, y: 127, w: 17, h: 5 }, paradas: 6, pausa: 2.5 },
      horario: DE_DIA,
      fotos: true,
      frases: {
        hola: [
          "Vine de Bogotá solo pa' fotografiar las carrozas. Me compré esta ruana en la plaza: aquí hace frío.",
          "¿Le tomo una foto con la comparsa de fondo? Quédese quieto… ¡listo!",
        ],
      },
      murmullos: ["¡Qué toma!", "Una más, una más", "Esta luz, qué belleza"],
    }),

    // ---------- Después de la estación, junto al palco ----------
    papel(F, "tomas", {
      rol: "Toca la guaneña en la vereda",
      area: "jardin",
      tile: { x: 108, y: ADELANTE },
      ...publico({ hola: ["La guaneña es el himno del carnaval. La toco hasta dormido.", "Esta la compuse anoche, al estilo de la guaneña, con tiple. Escuche."] }, ["Guaneña, guaneñita…", "¡Que suene!", "Tlin, tlan, tlin"]),
      pinta: { shirt: BLANCO, top2: NEGRO, head: "party-hat", accent: NEGRO },
      pedido: {
        id: "tinto-tomas",
        pide: [{ item: "tinto", n: 1 }],
        da: { item: "serpentinas", n: 2 },
        texto: "Llevo toda la mañana tocando la guaneña y se me secó la garganta. ¿Me trae un tinto?",
        gracias: "¡Ese tintico revive a cualquiera! Tenga unas serpentinas pa'l desfile.",
      },
    }),
    papel(F, "valentina", {
      rol: "Graba el desfile",
      area: "jardin",
      tile: { x: 112, y: ATRAS },
      ...corrillo("graban", { x: 113, y: ATRAS }),
      pinta: { ...DE(BLANCO, NEGRO, "#a07ad0"), face: "carnival-mask" },
      fotos: true,
      frases: { hola: ["¡En vivo desde el carnaval! Párate al lado, que sales en la toma.", "Si la comparsa me echa maicena, el celular sobrevive. Ya lo probé."] },
      murmullos: ["¡En vivo!", "¡Qué toma!", "Saluden, saluden"],
    }),
    papel(F, "santiago", {
      rol: "Graba el desfile",
      area: "jardin",
      tile: { x: 114, y: ATRAS },
      ...corrillo("graban", { x: 113, y: ATRAS }),
      pinta: DE(NEGRO, BLANCO, "#e05a3a"),
      fotos: true,
      frases: { hola: ["Valen me pidió que grabe de lado. Yo grabo de lado.", "¿Hay wifi en la calle? Pa' subir el video ya."] },
      murmullos: ["¿Hay wifi?", "Grabando…", "¡Ahí viene!"],
    }),
    papel(F, "mariana", {
      rol: "Corre con su máscara",
      area: "jardin",
      tile: { x: 118, y: 128 },
      comportamiento: { tipo: "deambula", zona: { x: 106, y: 126, w: 18, h: 6 }, paradas: 5, pausa: 0.8 },
      horario: NINOS,
      pinta: { ...DE(BLANCO, NEGRO, "#e05a7a"), face: "carnival-mask" },
      fiestero: DESFILE,
      frases: { hola: ["¡Mira mi máscara! La pinté yo: un lado blanco y otro negro.", "Canelo no quiere máscara. Dice que él ya es bonito."] },
      murmullos: ["¡Mira mi máscara!", "¡Canelo, baile!", "¡Ahí viene!"],
    }),
    canelo(F, `${F}:mariana`, { x: 117, y: 128 }, { horario: NINOS }),
    papel(F, "fredy", {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 120, y: ADELANTE },
      ...publico({ hola: ["Vine en bici desde el alto pa' ver el desfile. Diecisiete kilómetros.", "Las carrozas van a dos kilómetros por hora. Yo las paso caminando."] }, ["¡Eso, eso!", "¡Que viva!", "¡Más rápido, cóndor!"]),
      pinta: { ...DE(NEGRO, BLANCO, "#e8c03a"), head: "beanie" },
    }),
    suelto(F, "pipe", "Pipe", nino("#f1c27d", "#3a2418", { shirt: "#e05a3a", pants: NEGRO, accent: BLANCO, head: "cap", top: "graphic-tee" }), {
      rol: "Corre por la vereda",
      area: "jardin",
      tile: { x: 124, y: ADELANTE },
      comportamiento: {
        tipo: "ronda",
        corre: true,
        paradas: [
          { x: 124, y: ADELANTE, mira: "right", pausa: 0.5 },
          { x: 138, y: ATRAS, mira: "down", pausa: 0.8 },
          { x: 130, y: 127, mira: "left", pausa: 0.6 },
        ],
      },
      horario: NINOS,
      voz: 0.9,
      frases: { hola: ["¡Somos la comparsa más rápida del carnaval! ¡Síguenos!", "Lucía tiene una serpentina y me la quiere tirar. ¡Corra!"] },
      murmullos: ["¡Corre, Lucía!", "¡Viva el Carnaval!", "¡No me tires!"],
    }),
    suelto(F, "lucia", "Lucía", nino("#a86b3c", "#1b1b1b", { shirt: BLANCO, pants: "#7a4ab0", accent: "#e8c03a", hairStyle: "braids", face: "carnival-mask", top: "longsleeve", bottom: "skirt", shoes: "dress-shoes", shoeColor: NEGRO }), {
      rol: "Corre detrás de Pipe",
      area: "jardin",
      tile: { x: 123, y: ADELANTE },
      comportamiento: { tipo: "sigue", a: `${F}:pipe`, distancia: 1.3, corre: true },
      horario: NINOS,
      voz: 0.95,
      frases: { hola: ["¡Ya casi lo alcanzo! Tengo una serpentina con su nombre.", "Cuando sea grande voy a hacer carrozas de papel maché."] },
      murmullos: ["¡Pipe, ven acá!", "¡Serpentina va!"],
    }),
    suelto(F, "gonzalo", "Don Gonzalo", adulto("#c68642", "#8a8680", { shirt: "#8a2a2a", top2: "#e8c03a", pants: "#3a3030", outfit: "ruana", head: "straw-hat", facialHair: "beard" }), {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 128, y: ADELANTE },
      ...publico(
        {
          hola: [
            "Vengo de Sandoná con el sombrero de paja toquilla que tejió mi señora. Pa'l sol del mediodía.",
            "Cuando pasa la carroza de la Minga me acuerdo de la cosecha en la vereda. Bonito, ¿no?",
          ],
        },
        ["¡Ananay, qué bonito!", "¡Bravo, comparseros!", "Qué sol tan bravo"],
      ),
      llega: SENDERO,
      horario: { desde: hora(10, 15), hasta: DE_DIA.hasta },
      charla: "fondo",
    }),
    suelto(F, "martha", "Martha", adulto("#e0ac69", "#2a1810", { shirt: BLANCO, top2: NEGRO, pants: NEGRO, hairStyle: "long", outfit: "ruana", head: "pompom-beanie", accent: "#4ab0a0" }), {
      rol: "Espera el desfile en la vereda",
      area: "jardin",
      tile: { x: 130, y: ADELANTE },
      ...publico(
        {
          hola: [
            "Ya me echaron maicena tres veces, pero con permiso. Así se juega el Día de Blancos.",
            "Vine desde Túquerres. Allá también se goza, pero el desfile grande es el de aquí.",
          ],
        },
        ["Me echaron talco, ve", "¡Viva el Carnaval!", "¡Qué carroza tan bonita!"],
      ),
      talco: true,
      charla: "fondo",
    }),
    suelto(F, "camilo", "Camilo", adulto("#f1c27d", "#1f1a16", { hairStyle: "undercut", costume: "arlequin-pastuso", costumeGear: true, costumeColor: "#4ab0a0" }), {
      rol: "Se disfrazó de comparsero",
      area: "jardin",
      tile: { x: 135, y: ADELANTE },
      ...corrillo("amigos", { x: 136, y: ATRAS }),
      talco: true,
      frases: {
        hola: [
          "Nos disfrazamos pa'l concurso: yo de arlequín y Daniela de talco y ceniza. Ganamos seguro.",
          "Nos echamos talco entre nosotros, que pa' eso somos amigos. ¿Tú quieres?",
        ],
      },
      murmullos: ["¡Al concurso, al concurso!", "¡Que viva Pasto!", "¡Ahí viene la banda!"],
    }),
    suelto(F, "daniela", "Daniela", adulto("#a86b3c", "#3a2418", { hairStyle: "ponytail", costume: "talco-ceniza", costumeGear: true, costumeColor: "#e05a7a" }), {
      rol: "Se disfrazó de comparsera",
      area: "jardin",
      tile: { x: 137, y: ADELANTE },
      ...corrillo("amigos", { x: 136, y: ATRAS }),
      talco: true,
      frases: {
        hola: [
          "El traje lo cosimos anoche con Camilo. Se nos acabó el hilo negro a las dos de la mañana.",
          "Cuando pase la comparsa nos metemos a bailar. ¿Te animas?",
        ],
      },
      murmullos: ["¡Esa comparsa sí baila!", "¡Otra vuelta!", "¡Viva el Carnaval!"],
    }),
  ];
}
