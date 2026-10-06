// La gente de la Feria de la cosecha (VIR-169): el mercado campesino de la pradera y el patio de la casa.
// Los cinco puestos los atienden vecinos de la vereda (cada uno abre su puesto con `accion`), Don Ramiro
// hace la ronda con su mula y sus canastos, Doña Rubiela cuida la olla del sancocho, Don Efraín pesa las
// ahuyamas, Don Aurelio anuncia la tómbola de la junta con su megáfono, Mariana pasea con su globo y al
// atardecer llegan el tiple, la guitarra y la bandola al patio. Todo en tiles del jardín (los sitios salen
// de cosecha.ts, los mismos de la decoración).
import { COSECHA, COSECHA_PUESTOS, COSECHA_SITIOS, puestoVendedor, type PuestoCosecha } from "../cosecha";
import type { FiestaNpc, FrasesFiesta } from "../gente-fiesta";
import { hora, papel, suelto } from "./comun";
import type { VecinoId } from "./vecinos";

const F = "cosecha";
/** Campesino de feria: camisa de cuadros, sombrero, pañuelo y botas. */
const CAMPESINO = { top: "flannel" as const, head: "straw-hat" as const, neck: "neckerchief" as const, shoes: "boots" as const };
/** El baile: los vendedores también salen a bailar un rato cuando suena la música. */
const BAILE = [{ desde: COSECHA.baileMinuto, hasta: hora(21, 30) }];
/** Los músicos llegan al atardecer, por el sendero del patio. */
const MUSICOS = { desde: COSECHA.musicaDesde, hasta: hora(22) };
const LLEGAN = { x: 74, y: 29 };

/** Lo que dice cada vendedor (su puesto, la hora y la lluvia). */
const VENDEDORES: Record<string, { frases: FrasesFiesta; murmullos: string[]; pinta: Parameters<typeof papel>[2]["pinta"] }> = {
  tuberculos: {
    pinta: { ...CAMPESINO, accent: "#c03a3a" },
    frases: {
      hola: [
        "Papa, yuca, arracacha y cebolla: le compro lo que traiga de la huerta.",
        "Si no sembró yuca pa' la olla, aquí le vendo. Pero sembrada sabe mejor.",
        "La papa criolla se paga bien hoy. Mañana, quién sabe.",
      ],
      tarde: ["Ya pasó el mediodía y el bulto de papa va por la mitad. ¿Me ayuda a llenarlo?"],
      lluvia: ["Con este aguacero la papa sale llena de barro. Igual se la compro."],
    },
    murmullos: ["¡Papa criolla!", "Yuca fresquita", "Le compro la cosecha"],
  },
  frutas: {
    pinta: { outfit: "apron", head: "bandana", accent: "#e8c03a" },
    frases: {
      hola: [
        "Fresas, lulos, tomates, uchuvas… lo que traiga del huerto se lo recibo.",
        "El lulo pa' jugo es oro. Se lo pago como tal, bueno, casi.",
        "Pregunte en todos los puestos: cada rato cambia quién paga mejor.",
      ],
      manana: ["Madrugué a escoger la fruta. Lo bonito se vende primero."],
    },
    murmullos: ["¡Fresas y lulos!", "La fruta del huerto", "Pásele, vecino"],
  },
  granos: {
    pinta: { outfit: "ruana", head: "straw-hat", accent: "#5a8a3a" },
    frases: {
      hola: [
        "Le vendo semillas de fríjol cargamanto y de arracacha. Esas no las tiene el cobertizo.",
        "Mazorca, fríjol y cilantro: eso le compro. Lo demás, en los otros puestos.",
        "Semilla buena es la que guardó la abuela. Esta la guardé yo, que ya soy abuela.",
      ],
      tarde: ["Siembre ahorita el fríjol y en la próxima cosecha me lo vende a mí."],
    },
    murmullos: ["Semillas criollas", "Fríjol cargamanto", "Mazorca, mi amor"],
  },
  arepas: {
    pinta: { outfit: "apron", head: "flower", accent: "#e0923e" },
    frases: {
      hola: [
        "¡Arepas de choclo con quesito! Recién salidas del budare.",
        "Le compro mazorca, huevos y miel: todo eso va en las arepas.",
        "Yo enseñé treinta años en la escuela de la vereda. Ahora enseño a hacer arepas.",
      ],
      noche: ["De noche la arepa de choclo sabe a infancia. Lléveme una."],
    },
    murmullos: ["¡Arepas de choclo!", "Con quesito", "Calienticas"],
  },
  ahuyamas: {
    pinta: { top: "flannel", head: "bucket-hat", accent: "#3a8ad0" },
    frases: {
      hola: [
        "Le compro ahuyamas, plátano y papa. ¡Y vendo canastos tejidos por mi abuela!",
        "Las ahuyamas más grandes se pesan en la báscula de Don Efraín. Yo solo las compro.",
        "Esta feria la estoy transmitiendo. Salude, que ya somos como cuarenta.",
      ],
      tarde: ["Mi abuela teje un canasto en una tarde. Yo en una tarde no tejo ni un tweet."],
    },
    murmullos: ["¡Canastos de mimbre!", "Le compro la ahuyama", "Saluden al en vivo"],
  },
};

function vendedor(p: PuestoCosecha): FiestaNpc {
  const v = VENDEDORES[p.id]!;
  return papel(F, p.vecino as VecinoId, {
    rol: p.nombre,
    area: "jardin",
    tile: puestoVendedor(p),
    comportamiento: { tipo: "quieto", mira: "down" },
    pinta: v.pinta,
    accion: { tipo: "puesto", puesto: p.id },
    // Los puestos tienen toldo: con lluvia siguen atendiendo.
    lluvia: "sigue",
    fiestero: BAILE,
    frases: v.frases,
    murmullos: v.murmullos,
    ...(p.id === "arepas"
      ? {
          pedido: {
            id: "mazorcas-marina",
            pide: [{ item: "mazorca", n: 2 }],
            da: { item: "arepa-choclo", n: 2 },
            texto: "Me faltan dos mazorcas pa' las arepas y no puedo dejar el puesto. ¿Me las trae del huerto?",
            gracias: "¡Qué mazorcas tan bonitas! Tenga, dos arepas de choclo recién hechas, con quesito.",
          },
        }
      : {}),
  });
}

/** La ronda de Don Ramiro: por delante de los puestos, la báscula, la tómbola y hasta el patio. */
const RONDA_RAMIRO = [
  { x: 76, y: 52, mira: "right" as const, pausa: 2 },
  { x: 87, y: 52, mira: "up" as const, pausa: 2 },
  { x: 97, y: 52, mira: "up" as const, pausa: 3 },
  { x: 90, y: 56 },
  { x: 78, y: 56, mira: "left" as const, pausa: 2 },
  { x: 72, y: 46 },
  { x: 80, y: 28, mira: "up" as const, pausa: 3 },
  { x: 74, y: 40 },
];

export function GENTE_COSECHA(): FiestaNpc[] {
  const o = COSECHA_SITIOS.olla;
  const b = COSECHA_SITIOS.bascula;
  const t = COSECHA_SITIOS.tombola;
  return [
    ...COSECHA_PUESTOS.map(vendedor),
    papel(F, "rubiela", {
      rol: "Cuida la olla del sancocho",
      area: "jardin",
      tile: { x: o.x + 2, y: o.y },
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: { outfit: "apron", head: "bandana", accent: "#c03a3a" },
      lleva: "cucharon",
      lluvia: "sigue",
      frases: {
        hola: [
          "Échele algo a la olla, que el sancocho es de todos: papa, yuca, mazorca, plátano, cilantro, cebolla y huevito.",
          "Cuando la olla se llena, hierve un ratico y le sirvo a todo el que esté cerca.",
          "Tengo leña pa' tres ollas. Si la gente colabora, alcanza pa' todos.",
        ],
        tarde: ["Al que se queda pa'l baile le guardo el concho de la olla."],
        noche: ["De noche el fogón calienta más que la ruana."],
        lluvia: ["Llueva o no llueva, el sancocho no se apaga. Arrímese al fogón."],
      },
      murmullos: ["¡Revuelvan la olla!", "Falta cilantro…", "Huele a domingo"],
    }),
    papel(F, "ramiro", {
      rol: "Campesino con su mula",
      area: "jardin",
      tile: RONDA_RAMIRO[0]!,
      comportamiento: { tipo: "ronda", paradas: RONDA_RAMIRO },
      pinta: { ...CAMPESINO, outfit: "ruana", accent: "#8a5a2a" },
      frases: {
        hola: [
          "Bajé desde la vereda con la Pinta y dos canastos de papa. Ella carga, yo converso.",
          "La mula se llama la Pinta. No le toque la oreja izquierda, que es delicada.",
          "Sembrar es fácil. Lo difícil es esperar.",
        ],
        tarde: ["A esta hora la Pinta ya quiere volver. Yo quiero sancocho."],
      },
      murmullos: ["¡Arre, Pinta!", "Despacito…", "Qué cosecha tan buena"],
      fiestero: BAILE,
      pedido: {
        id: "papas-ramiro",
        pide: [{ item: "papa", n: 3 }],
        da: { puntos: 10 },
        texto: "Se me rompió un canasto en el camino y perdí papas. ¿Me completa con tres papas criollas del huerto?",
        gracias: "Dios le pague. Ahora sí llego con el bulto completo.",
      },
    }),
    {
      id: `${F}:pinta`,
      nombre: "La Pinta",
      rol: "La mula de Don Ramiro",
      area: "jardin",
      tile: { x: RONDA_RAMIRO[0]!.x - 1, y: RONDA_RAMIRO[0]!.y },
      comportamiento: { tipo: "sigue", a: `${F}:ramiro`, distancia: 1.4 },
      look: { skin: "#8a5a3a", hair: "#3a2414", shirt: "#8a5a3a", pants: "#8a5a3a", accent: "#c03a3a", hairStyle: "short", accessories: [] },
      animal: { especie: "mula", pelaje: "parda" },
      frases: { hola: ["La Pinta mueve las orejas y lo mira de reojo.", "La Pinta resopla. Los canastos de papa se mecen.", "La Pinta le huele la mochila, a ver si trae mazorca."] },
      murmullos: ["¡Jiii-jaaa!", "Resopla…"],
      voz: 0.15,
    },
    papel(F, "efrain", {
      rol: "El de la báscula del concurso",
      area: "jardin",
      tile: { x: b.x + 1, y: b.y - 1 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { outfit: "vest", head: "straw-hat", accent: "#3a6a9a" },
      lluvia: "sigue",
      frases: {
        hola: [
          "Traiga su ahuyama en la mano y yo se la peso. La báscula no tiene amigos.",
          "Una ahuyama bien regada y en su temporada pesa el doble. Eso no es suerte, es cuidado.",
          "Al cierre se premia la más pesada. Mire el tablero, ahí van todas.",
        ],
        tarde: ["Ya pesé ahuyamas de todos los tamaños. Falta la suya."],
      },
      murmullos: ["¡A pesar!", "Esa está gordita", "La báscula no miente"],
    }),
    papel(F, "aurelio", {
      rol: "Presidente de la junta de acción comunal",
      area: "jardin",
      tile: { x: t.x + 2, y: t.y },
      comportamiento: { tipo: "quieto", mira: "left" },
      pinta: { outfit: "blazer", head: "straw-hat", accent: "#2a5a3a" },
      lleva: "megafono",
      frases: {
        hola: [
          `La boleta de la tómbola vale ${COSECHA.boletaPrecio} puntos y cada quien compra hasta ${COSECHA.boletasMax}. Lo recogido es pa' arreglar el camino de la vereda.`,
          "El premio es una carreta de madera cargada de ahuyamas. No se consigue en ningún otro lado.",
          "El sorteo es al cierre, con megáfono y todo. La junta es seria.",
        ],
        tarde: ["Todavía hay boletas. La suerte no espera, vecino."],
      },
      murmullos: ["¡Boletas pa' la tómbola!", "¡Atención, vecinos!", "Colabore con la junta"],
    }),
    suelto(F, "mariana", "Mariana", { skin: "#e8b88a", hair: "#3a2414", shirt: "#e0923e", pants: "#3a4a6a", accent: "#e8457a", hairStyle: "ponytail", eyes: "big", top: "tshirt", bottom: "skirt", shoes: "sneakers", shoeColor: "#e8e4dc" }, {
      rol: "Pasea por la feria con su globo",
      area: "jardin",
      tile: { x: 84, y: 56 },
      comportamiento: { tipo: "deambula", zona: { x: 74, y: 51, w: 26, h: 7 }, paradas: 6, pausa: 1.2 },
      lleva: "globo",
      voz: 0.9,
      frases: {
        hola: ["¡Mire mi globo! Me lo regaló Don Aurelio por ayudarle a vender boletas.", "Yo quiero que gane la ahuyama de mi abuela. Es más grande que yo.", "¿Ya probó la arepa de choclo? Es la mejor del mundo."],
      },
      murmullos: ["¡Mi globo!", "¡Arepa, arepa!", "¡Qué ahuyama tan grande!"],
    }),
    ...(
      [
        ["tomas", "Toca el tiple en el baile", "tiple", { x: 82, y: 22 }, ["Un bambuco pa' la cosecha: lo compuse mirando el maizal.", "El tiple tiene doce cuerdas. Yo me sé once."]],
        ["fredy", "Toca la guitarra en el baile", "guitarra-mano", { x: 82, y: 23 }, ["Yo llevo el bajo con la guitarra. Si me equivoco, nadie se da cuenta.", "Dejé la bicicleta por una tarde. Esto también es deporte."]],
        ["santiago", "Aprendiz de bandola", "bandola", { x: 82, y: 24 }, ["Estoy aprendiendo bandola con Tomás. Hoy me deja tocar la melodía.", "La bandola suena como un pajarito. Bueno, cuando la toco bien."]],
      ] as const
    ).map(([id, rol, instrumento, tile, hola]) =>
      papel(F, id, {
        rol,
        area: "jardin",
        tile,
        llega: LLEGAN,
        horario: MUSICOS,
        comportamiento: { tipo: "quieto", mira: "right" },
        pinta: { ...CAMPESINO, accent: "#c08a2a" },
        lleva: instrumento,
        charla: "musicos",
        lluvia: "sigue",
        frases: { hola },
        murmullos: ["Tlin, tlan…", "¡Que viva la cosecha!", "Un bambuco más"],
      }),
    ),
  ];
}
