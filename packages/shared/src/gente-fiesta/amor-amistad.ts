// La gente de Amor y amistad (VIR-162): la plaza del amor en el pasto al este del camino de piedra. Don
// Aurelio y Doña Carmenza bailan un bolero, Doña Rubiela atiende el puesto de chocolates y flores, el
// cartero Cupido (Fredy, con alas) corre por el jardín, Mariana y Samuel se cambian tarjetas, Santiago
// ensaya qué decirle a alguien (y necesita una rosa), el trío de cuerdas espera su próxima serenata, la
// Profe Marina recita poemas junto al cofre, Valentina toma fotos en la banca de los enamorados y Luz Dary
// y Chepe pasean de la mano. Todo en tiles del jardín (la decoración: world/festivales/amor-amistad.ts).
import type { FiestaNpc } from "../gente-fiesta";
import type { Look } from "../look";
import { canelo, nino, papel, suelto } from "./comun";
import { vestirVecino } from "./vecinos";

const F = "amor-amistad";
const LUZDARY = `${F}:luzdary`;
const MARIANA = `${F}:mariana`;

/** La plaza (tiles del jardín): por donde pasean y donde se paran. */
const PLAZA = { x: 74, y: 49, w: 22, h: 8 };

/** El cartero Cupido: Fredy con alas de papel y la maleta de las cartas. */
export const CUPIDO = {
  id: `${F}:fredy`,
  nombre: "Cupido",
  look: vestirVecino("fredy", { shirt: "#f4a0b8", top: "tshirt", accent: "#d0547a", back: "wings", head: "headband", face: "none", neck: "bowtie" }),
} as const;

/** El trío de la serenata: tiple, guitarra y requinto (dibujos de la mano en items.ts). */
export const TRIO_SERENATA: readonly { id: string; nombre: string; look: Look; instrumento: string }[] = [
  { id: `${F}:tomas`, nombre: "Tomás", look: vestirVecino("tomas", { top: "dress-shirt", shirt: "#f4ecdc", pants: "#2a2430", neck: "bowtie", accent: "#a02840", back: "none", head: "none" }), instrumento: "tiple" },
  {
    id: `${F}:jairo`,
    nombre: "Don Jairo",
    look: { accessories: [], skin: "#c68642", hair: "#3a3430", shirt: "#f4ecdc", pants: "#2a2430", accent: "#a02840", hairStyle: "short", facialHair: "mustache", top: "dress-shirt", neck: "bowtie", shoes: "dress-shoes", shoeColor: "#1a1210" },
    instrumento: "guitarra",
  },
  {
    id: `${F}:hernando`,
    nombre: "Don Hernando",
    look: { accessories: [], skin: "#e0ac69", hair: "#d8d4ce", shirt: "#f4ecdc", pants: "#2a2430", accent: "#a02840", hairStyle: "side-part", top: "dress-shirt", neck: "bowtie", face: "glasses", shoes: "dress-shoes", shoeColor: "#1a1210" },
    instrumento: "requinto",
  },
];

/** Donde espera el trío (en fila, mirando a la plaza) y el punto para pedir la serenata, delante. */
export const TRIO_TILES = [
  { x: 88, y: 54 },
  { x: 89, y: 54 },
  { x: 90, y: 54 },
] as const;

const TRIO_FRASES: readonly { hola: string[]; murmullos: string[] }[] = [
  {
    hola: ["Somos Los Trovadores de la Vereda. Pídanos una serenata y le llegamos a quien usted diga.", "El tiple es el alma del trío. La guitarra lo acompaña y el requinto le pone el adorno.", "Hoy tocamos un pasillo que compusimos para la cabaña. Nadie lo ha oído todavía."],
    murmullos: ["Afinando…", "Un pasillo", "¿Serenata?"],
  },
  {
    hola: ["Yo llevo cuarenta años con esta guitarra. Ella es la que se sabe las canciones.", "La serenata se da de noche, pero en amor y amistad se vale a cualquier hora.", "Con propina tocamos con más sentimiento. Eso dicen."],
    murmullos: ["Tres por cuatro", "Con sentimiento", "Afinen, pues"],
  },
  {
    hola: ["El requinto es chiquito pero es el que más trabaja.", "Dígale a esa persona especial que la estamos esperando.", "Una serenata a la vez, que el trío también descansa."],
    murmullos: ["Tirirí…", "Otra vez desde arriba", "Qué buena noche"],
  },
];

export function GENTE_AMOR(): FiestaNpc[] {
  const trio = TRIO_SERENATA.map(
    (m, i): FiestaNpc => ({
      id: m.id,
      nombre: m.nombre,
      look: m.look,
      rol: ["Toca el tiple en el trío", "Toca la guitarra en el trío", "Toca el requinto en el trío"][i]!,
      area: "jardin",
      tile: TRIO_TILES[i]!,
      comportamiento: { tipo: "quieto", mira: "down" },
      lleva: m.instrumento,
      charla: "trio",
      voz: [0.45, 0.25, 0.32][i],
      ...(i === 0 ? { vecino: "tomas" as const } : {}),
      frases: { hola: TRIO_FRASES[i]!.hola, noche: ["De noche la serenata sabe mejor. Pídala ya."] },
      murmullos: TRIO_FRASES[i]!.murmullos,
    }),
  );
  return [
    // Los abuelos que bailan un bolero en la mitad de la plaza.
    papel(F, "aurelio", {
      rol: "Baila un bolero con Doña Carmenza",
      area: "jardin",
      tile: { x: 81, y: 54 },
      comportamiento: { tipo: "baila", mira: "right" },
      charla: "bolero",
      pinta: { top: "dress-shirt", shirt: "#f4ecdc", neck: "bowtie", accent: "#a02840", head: "straw-hat" },
      frases: {
        hola: ["Cincuenta y dos años bailando con Carmenza. Todavía me pisa, pero con cariño.", "El bolero se baila despacito, como se dicen las cosas importantes.", "En mis tiempos uno le mandaba una tarjeta a la novia y esperaba la respuesta una semana."],
        noche: ["Con estos faroles rosados hasta parece que tuviéramos veinte años."],
      },
      murmullos: ["Despacito…", "Un, dos, tres", "Mi Carmenza"],
    }),
    papel(F, "carmenza", {
      rol: "Baila un bolero con Don Aurelio",
      area: "jardin",
      tile: { x: 82, y: 54 },
      comportamiento: { tipo: "baila", mira: "left" },
      charla: "bolero",
      pinta: { outfit: "dress", shirt: "#d0547a", head: "flower", accent: "#f4ecdc" },
      frases: {
        hola: ["Aurelio dice que yo lo piso. Mentiras: él es el que no lleva el compás.", "El secreto de un matrimonio largo es bailar aunque la música esté mala.", "¿Usted ya tiene amigo secreto? Yo le voy a regalar a Aurelio un pañuelo. Otra vez."],
      },
      murmullos: ["¡Ay, Aurelio!", "Qué bolero tan lindo", "Despacio, mi amor"],
    }),
    // La del puesto: chocolatinas, rosas y tarjetas (abre el puesto) y pide fresas para bañarlas en chocolate.
    papel(F, "rubiela", {
      rol: "Vende chocolatinas y flores",
      area: "jardin",
      tile: { x: 84, y: 49 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { outfit: "apron", shirt: "#d0547a", head: "flower", accent: "#f4ecdc", neck: "none" },
      accion: { tipo: "puesto" },
      lluvia: "sigue",
      frases: {
        hola: ["¡Chocolatinas de corazón, rosas rojas y tarjetas! Para el amigo secreto y para el que no es tan secreto.", "La rosa roja es para el amor; la tarjeta, para la amistad. La chocolatina sirve para las dos.", "Si no sabe qué regalar, una caja de bombones nunca falla."],
        tarde: ["Ya se me están acabando las rosas. Hoy todo el mundo está enamorado."],
      },
      murmullos: ["¡Chocolatinas!", "Rosas rojas…", "Tarjeticas bonitas"],
      pedido: {
        id: "fresas-rubiela",
        pide: [{ item: "fresa", n: 3 }],
        da: { item: "chocolatina-corazon", n: 2 },
        texto: "Quiero bañar unas fresas en chocolate para la venta, pero se me acabaron. ¿Me trae tres del huerto? Le pago con chocolatinas.",
        gracias: "¡Qué fresas tan rojitas! Tome sus chocolatinas, que se las ganó.",
      },
    }),
    // El cartero Cupido corre por el jardín (las cartas las entrega en persona, aparte).
    {
      id: CUPIDO.id,
      nombre: CUPIDO.nombre,
      look: CUPIDO.look,
      vecino: "fredy",
      voz: 0.6,
      rol: "El cartero del amor y la amistad",
      area: "jardin",
      tile: { x: 82, y: 52 },
      comportamiento: {
        tipo: "ronda",
        corre: true,
        paradas: [
          { x: 82, y: 52, mira: "down", pausa: 2 },
          { x: 64, y: 34, mira: "left", pausa: 1.5 },
          { x: 61, y: 35, mira: "up", pausa: 1.5 },
          { x: 66, y: 46, pausa: 1 },
          { x: 70, y: 58, mira: "down", pausa: 1.5 },
          { x: 90, y: 55, pausa: 1 },
        ],
      },
      lluvia: "sigue",
      frases: {
        hola: ["¡Soy Cupido, el cartero del corazón! Si le escribe una carta a alguien en el buzón, yo se la llevo en persona.", "Las cartas van sin firma. Yo no digo nada, así me paguen.", "Hoy ya llevo un montón de cartas. Y eso que apenas empieza el día."],
        lluvia: ["Ni la lluvia para al correo del corazón. Las cartas van bien guardaditas."],
      },
      murmullos: ["¡Correo!", "¡Abran paso!", "Carta urgente"],
    },
    // Los niños que se cambian tarjetas (y Canelo, detrás de Mariana).
    papel(F, "mariana", {
      rol: "Se cambia tarjetas con Samuel",
      area: "jardin",
      tile: { x: 93, y: 53 },
      comportamiento: { tipo: "grupo", grupo: "tarjetas", centro: { x: 94, y: 53 } },
      pinta: { head: "bow", accent: "#d0547a", shirt: "#f4a0b8" },
      lleva: "tarjeta-amistad",
      frases: { hola: ["¡Le hice una tarjeta a Canelo! Pero se la comió.", "Samuel me dio una tarjeta con un dinosaurio. ¡Es la más bonita!", "¿Tú tienes amigo secreto? El mío es Samuel, pero él no sabe."] },
      murmullos: ["¡Te cambio esta!", "¡Esa es mía!", "Qué bonita"],
    }),
    suelto(F, "samuel", "Samuel", nino("#c68642", "#2a1a10", { shirt: "#5fb8e8", accent: "#d0547a", hairStyle: "curly" }), {
      rol: "Se cambia tarjetas con Mariana",
      area: "jardin",
      tile: { x: 95, y: 53 },
      comportamiento: { tipo: "grupo", grupo: "tarjetas", centro: { x: 94, y: 53 } },
      lleva: "tarjeta-amistad",
      voz: 0.82,
      frases: { hola: ["Yo tengo diez tarjetas. Mariana tiene nueve. Le gané.", "Esta tarjeta tiene un dinosaurio enamorado. Es la mejor.", "Mi mamá dice que en amor y amistad hay que decirle a la gente que uno la quiere. Yo te quiero. Ya."] },
      murmullos: ["¡Tengo diez!", "Te la cambio", "¡Un dinosaurio!"],
    }),
    canelo(F, MARIANA, { x: 93, y: 55 }, { comportamiento: { tipo: "sigue", a: MARIANA, distancia: 1.6, corre: true } }),
    // El enamorado nervioso: ensaya junto a la banca qué le va a decir a alguien. Le falta la rosa.
    papel(F, "santiago", {
      rol: "Ensaya qué le va a decir a alguien",
      area: "jardin",
      tile: { x: 89, y: 52 },
      comportamiento: {
        tipo: "ronda",
        paradas: [
          { x: 89, y: 52, mira: "right", pausa: 2 },
          { x: 93, y: 52, mira: "left", pausa: 2 },
        ],
      },
      pinta: { top: "dress-shirt", shirt: "#f4ecdc", bottom: "pants", head: "none", neck: "tie", accent: "#a02840" },
      frases: {
        hola: [
          "Ehh… hola. No, así no. Hola, ¿cómo estás? No, muy formal. Ay, no sé.",
          "Voy a decirle que me gusta desde el colegio. O que me gusta su perro. Algo así.",
          "Usted tiene cara de saber de estas cosas. ¿Qué se le dice a alguien que a uno le gusta?",
        ],
        tarde: ["Ya ensayé cuarenta veces. Me sale peor cada vez."],
      },
      murmullos: ["Hola… no.", "Respira, Santiago", "¿Y si me dice no?"],
      pedido: {
        id: "rosa-santiago",
        pide: [{ item: "rosa-roja", n: 1 }],
        da: { puntos: 8 },
        texto: "Me falta lo más importante: una rosa. Doña Rubiela tiene en el puesto, pero me da pena ir. ¿Me trae una? Se la pago.",
        gracias: "¡Gracias! Ahora sí. Bueno, ahora casi. Deséeme suerte.",
      },
    }),
    // El trío de cuerdas.
    ...trio,
    // La Profe Marina recita poemas de amor junto al cofre.
    papel(F, "marina", {
      rol: "Recita poemas junto al cofre",
      area: "jardin",
      tile: { x: 78, y: 52 },
      comportamiento: { tipo: "quieto", mira: "right" },
      pinta: { neck: "pearls", head: "flower", accent: "#d0547a" },
      frases: {
        hola: ["La amistad es un amor que no se declara. Eso lo escribí yo, a los quince años.", "Anótese al amigo secreto en ese cofre. Y no haga trampa: no se vale averiguar.", "Un buen detalle no tiene que ser caro: tiene que ser pensado."],
        noche: ["De noche los poemas suenan mejor. Siéntese y le recito uno."],
      },
      murmullos: ["Escucha, corazón…", "Versos de amor", "Eso no se dice así"],
    }),
    // Valentina toma fotos en la banca de los enamorados.
    papel(F, "valentina", {
      rol: "Toma fotos en la banca de los enamorados",
      area: "jardin",
      tile: { x: 90, y: 52 },
      comportamiento: { tipo: "deambula", zona: { x: 88, y: 51, w: 7, h: 3 }, paradas: 4, pausa: 2 },
      pinta: { head: "flower", accent: "#d0547a" },
      fotos: true,
      frases: { hola: ["¡Siéntese en la banca de los enamorados y tómese una foto! Sale con marco de corazones.", "Las fotos de la banca son las más bonitas de toda la fiesta.", "¿Con quién se va a tomar la foto? No le pregunto más."] },
      murmullos: ["¡Sonrían!", "Una más", "Qué parejita"],
    }),
    // Luz Dary y Chepe pasean por la plaza.
    papel(F, "luzdary", {
      rol: "Pasea con Chepe",
      area: "jardin",
      tile: { x: 76, y: 52 },
      comportamiento: { tipo: "deambula", zona: PLAZA, paradas: 6, pausa: 1.5 },
      charla: "pareja",
      pinta: { outfit: "dress", shirt: "#e8457a", head: "flower", accent: "#f4ecdc", neck: "none" },
      frases: { hola: ["Chepe me trajo a la fiesta en la moto. Con casco y todo, como debe ser.", "Hoy no atiendo perros ni gatos. Hoy atiendo a Chepe.", "¿Ya pasó por el puesto? Las rosas están divinas."] },
      murmullos: ["¡Qué bonito todo!", "Ven, Chepe", "Mira esa banca"],
    }),
    papel(F, "chepe", {
      rol: "Pasea con Luz Dary",
      area: "jardin",
      tile: { x: 75, y: 52 },
      comportamiento: { tipo: "sigue", a: LUZDARY, distancia: 1.2 },
      charla: "pareja",
      pinta: { outfit: undefined, top: "dress-shirt", shirt: "#e8e4dc", pants: "#2a3a5a", head: "none" },
      frases: { hola: ["Me lavé las manos tres veces para no dejarle grasa a Luz Dary.", "Yo de romántico tengo poco, pero ella dice que con eso le basta.", "Le compré una rosa. Bueno, dos: una se me cayó en el aceite."] },
      murmullos: ["Sí, mi amor", "Ya voy", "Qué calor"],
    }),
  ];
}
