// Lo que se lee en las estanterías: cada título de `BOOK_TITLES` (casa.ts) trae su autor inventado y
// unas pocas páginas (poemas, cuentos cortos, guías de mentira). Textos originales de la casa (la carta
// es de Juan Ordoñez, tal cual la escribió). Cada página
// es texto plano: "\n" corta el verso o el renglón y una línea vacía separa párrafos o estrofas.
import { BOOK_TITLES } from "./casa";

export type BookKind = "poemas" | "cuento" | "guía" | "recetas" | "diario" | "carta";

export interface Book {
  title: (typeof BOOK_TITLES)[number];
  author: string;
  kind: BookKind;
  /** Una línea para la portadilla. */
  blurb: string;
  pages: string[];
}

export const BOOKS: Book[] = [
  {
    title: "El jardín de las tazas vacías",
    author: "Amparo Linares",
    kind: "poemas",
    blurb: "Poemas para después del café.",
    pages: [
      "I\n\nQuedó la taza en la ventana\ncon un anillo de café,\ncomo un planeta pequeño\nque ya no sabe qué hacer.\n\nLa miro y pienso en la tarde\nque cupo entera en su borde,\nen lo que dijimos rápido\ny en lo que quedó sin nombre.",
      "II\n\nSembré tazas en el jardín\npara ver qué florecía:\nuna dio un rayo de sol,\nla otra, melancolía.\n\nLa tercera dio una abeja\nque se quedó a conversar;\nsupe entonces que las tazas\nno se vacían del todo jamás.",
      "III\n\nLo que se toma despacio\ndeja su tibieza atrás.\nPor eso las tazas vacías\nno están vacías: están\n\nesperando a que alguien vuelva\ncon la tetera en la mano\ny diga, como quien nada:\n«¿Otro? Ya casi es verano.»",
      "IV\n\nAl final del día lavo\nuna por una, sin prisa.\nEl agua se lleva el azúcar\ny me devuelve la risa\n\nde quien bebió en cada una.\nLas pongo boca abajo al sol.\nMañana serán jardín\nde nuevo. Mañana, mejor.",
    ],
  },
  {
    title: "Cien maneras de hacer café",
    author: "Tobías Arango",
    kind: "guía",
    blurb: "Solo se incluyen las siete que el autor recuerda.",
    pages: [
      "Advertencia\n\nEste libro prometía cien maneras. El autor se tomó las primeras noventa y tres mientras las escribía y no recuerda ninguna.\n\nLas siete que sobreviven se presentan con orgullo y un leve temblor en la mano.",
      "Manera nº 1: la de la abuela\n\nHierva agua en una olla que tenga más años que usted. Eche el café sin medirlo. Espere a que suba. Cuele con un trapo que no se usa para nada más.\n\nSírvalo en taza de peltre. Nunca le pregunte a la abuela cuánto café echó: ella tampoco sabe.",
      "Manera nº 2: la de la oficina\n\nOprima el botón. Espere. Oprima el botón otra vez, porque no pasó nada. Golpee suavemente la máquina en el costado izquierdo.\n\nAgradezca al universo el chorrito. Llévelo a la reunión y déjelo enfriar mientras alguien comparte pantalla.",
      "Manera nº 3: la de acampar\n\nOlvide el filtro. Improvise con una media limpia (lávela antes; en serio, lávela).\n\nEl café sabrá a humo, a pino y a la promesa de que el próximo viaje se empaca mejor. Es el mejor café del mundo.",
      "Maneras nº 4 a 7\n\n4. Frío: prepárelo de noche y olvídelo en la nevera.\n5. Con panela: como debe ser.\n6. Con canela: para las visitas.\n7. Recalentado a las tres de la tarde: nadie lo recomienda, todos lo hemos hecho.\n\nFin del libro. El autor fue a hacer más café.",
    ],
  },
  {
    title: "Manual del buen vecino",
    author: "Comité de la cabaña",
    kind: "guía",
    blurb: "Reglas de convivencia aprobadas por mayoría (y un gato).",
    pages: [
      "Artículo 1\n\nSe saluda al entrar. Se saluda al salir. Si ya se saludó y se vuelve a cruzar en el pasillo, basta una sonrisa o levantar las cejas.\n\nArtículo 2\n\nQuien se toma el último café, prepara el siguiente. Sin excepciones. El comité está mirando.",
      "Artículo 3\n\nLa música de la oficina se pone a un volumen que no atraviese paredes. Las paredes de esta casa son delgadas y chismosas.\n\nArtículo 4\n\nLas plantas comunes se riegan. Si una planta parece triste, se le habla. Si sigue triste, se le avisa al jardinero.",
      "Artículo 5\n\nSe toca la puerta de la oficina cerrada. Si no abren, se deja una nota amable. Las notas groseras se las come la mascota de turno.\n\nArtículo 6\n\nNadie se sienta en la silla de otro durante una reunión. Hay sillas de sobra. Contamos.",
      "Artículo 7 (transitorio)\n\nQueda prohibido esconder el control de la tele del salón. Quien lo encuentre debajo de un cojín lo devuelve a la mesita, sin preguntas.\n\nFirmado en la cabaña, un martes lluvioso, por todos los presentes y una huella de pata.",
    ],
  },
  {
    title: "La cabaña del bosque dormido",
    author: "Eliseo Marín",
    kind: "cuento",
    blurb: "Un cuento para leer junto a la chimenea.",
    pages: [
      "Había una vez un bosque que se quedaba dormido todas las tardes a las cinco. Los pájaros bajaban la voz, las ardillas guardaban sus nueces y hasta el viento caminaba de puntillas.\n\nEn medio del bosque había una cabaña con la chimenea siempre encendida, y en la cabaña vivía gente que no tenía sueño.",
      "—Si el bosque duerme —dijo una de ellas—, ¿quién nos cuida?\n\nNadie supo qué responder. Salieron al jardín con una linterna y encontraron, entre los pinos, un zorro viejo sentado sobre una piedra.\n\n—Yo cuido —dijo el zorro—. Siempre he cuidado. Nunca nadie me había visto.",
      "Desde esa noche le dejaron un plato de pan en la puerta. El zorro no entraba, porque los zorros no entran a las casas, pero se acostaba bajo la ventana de la cocina.\n\nY cuando el bosque se dormía, en la cabaña se oía un ronquido pequeño, del lado de afuera, que hacía sentir a todos muy acompañados.",
      "Dicen que el zorro sigue ahí. Que si uno sale al jardín a la hora en que se prenden los faroles, y mira bien entre los troncos, ve dos puntos de luz que parpadean despacio.\n\nNo hay que llamarlo. Basta con decir «buenas noches» en voz baja. Él contesta a su manera: el bosque entero respira un poco más tranquilo.",
    ],
  },
  {
    title: "Recetas de la abuela Inés",
    author: "Inés Cárdenas (dictado a su nieta)",
    kind: "recetas",
    blurb: "Sin medidas exactas. Nunca las hubo.",
    pages: [
      "Arepa de la mañana\n\nMasa, sal y agua tibia, hasta que se sienta como el lóbulo de la oreja. No me pregunte por qué la oreja: así me enseñaron.\n\nAl fuego lento, que se dore sin afán. La mantequilla va encima, generosa. La arepa se come caliente o se come con remordimiento.",
      "Changua para los domingos\n\nLeche y agua a partes iguales, una pizca de sal, cebolla larga picada. Cuando hierva, se rompen los huevos adentro con cuidado, como quien acuesta a un niño.\n\nCilantro al final y el pan del día anterior en el fondo del plato. Cura el frío, el cansancio y algunas tristezas.",
      "Agua de panela\n\nUn pedazo de panela, agua, y paciencia. Si hace frío, con limón. Si hay visita, con queso adentro para que se derrita.\n\nLa abuela decía: «La panela no se apura». Tenía razón en eso y en casi todo lo demás.",
      "Nota de la nieta\n\nIntenté medir todo con tazas y cucharas mientras ella cocinaba. Ella me miraba de reojo y cambiaba las cantidades cada vez, a propósito.\n\nAl final entendí: la receta no era la medida. Era estar ahí, en la cocina, oyéndola cantar mientras revolvía.",
    ],
  },
  {
    title: "Astronomía para días nublados",
    author: "Dra. Celeste Ruiz",
    kind: "guía",
    blurb: "Cómo ver estrellas cuando no se ve nada.",
    pages: [
      "Capítulo 1: No se desanime\n\nLas estrellas siguen ahí aunque las nubes digan lo contrario. Esa es la primera lección de este libro y, siendo honestos, casi la única.\n\nLo que sigue son técnicas para imaginarlas con la mayor precisión científica posible.",
      "Capítulo 2: La constelación del Termo\n\nMire hacia donde debería estar el norte. Imagine tres estrellas en fila y una curva arriba: es la asa. Es el Termo, visible solo en las noches de trabajo largas.\n\nSegún la tradición, quien la encuentra termina el informe a tiempo.",
      "Capítulo 3: La Osa Dormida\n\nNo confundir con la Osa Mayor. La Osa Dormida está hecha de las luces de las casas vecinas cuando se apagan, una por una, pasada la medianoche.\n\nSe observa mejor desde la terraza, con una cobija y una aromática.",
      "Capítulo 4: Conclusión\n\nEl cielo nublado también es cielo. A veces, detrás de la nube, pasa un avión con su lucecita roja, y uno piensa en toda la gente que va adentro, cada una con su historia.\n\nEso también es astronomía. De la más bonita.",
    ],
  },
  {
    title: "El gato que quería ser faro",
    author: "Lucía Pardo",
    kind: "cuento",
    blurb: "Para lectores de todas las edades y todas las especies.",
    pages: [
      "Nube era un gato blanco que vivía en el piso más alto de la casa. Desde la ventana veía el lago, y en el lago, de noche, no había ninguna luz.\n\n—Los barcos se van a perder —pensaba Nube, aunque en el lago no había barcos. Solo patos. Pero los patos también se pierden, decía él.",
      "Así que Nube decidió ser faro. Todas las noches se sentaba en el alféizar, con el pecho blanco hacia el agua, y abría mucho los ojos para que brillaran.\n\nLos patos no se dieron cuenta. La luna sí. Y la luna, que es muy amiga de los gatos, empezó a asomarse justo detrás de él.",
      "Desde el lago, la ventana se veía como una lámpara con orejas. Un pato joven que se había alejado demasiado la vio, dio la vuelta y nadó de regreso a su orilla.\n\nNube nunca supo que había funcionado. Pero esa noche durmió especialmente bien, hecho una rosca, como duermen los faros satisfechos.",
    ],
  },
  {
    title: "Historia secreta de las medias perdidas",
    author: "Prof. Hernando Gil",
    kind: "guía",
    blurb: "Una investigación que el gobierno no quiere que lea.",
    pages: [
      "Introducción\n\nDurante siglos, la humanidad ha perdido una media de cada par sin preguntarse adónde van. Este libro, fruto de treinta años de investigación en lavanderías, por fin responde.\n\nAdelanto: se van juntas. Tienen una comunidad.",
      "Capítulo 1: La fuga\n\nLa media espera el ciclo de centrifugado. En el momento de mayor confusión, se esconde en el pliegue de una sábana. De ahí salta al piso, de ahí a la rejilla, y de ahí, a la libertad.\n\nLa otra media, la que se queda, lo sabía. Por eso nunca protesta.",
      "Capítulo 2: La comunidad\n\nLas medias libres viven detrás de las lavadoras, en ciudades pequeñas y tibias. Tienen alcaldesa (una media de rombos), fiestas en diciembre y un museo del par perdido.\n\nNo son infelices. Solo querían conocer el mundo.",
      "Conclusión\n\nSi encuentra una media sola, no la bote. Quizá su pareja vuelva algún día, cansada de la aventura, con historias que contar.\n\nY si no vuelve, use medias distintas con dignidad. Es la forma más honesta de honrar a las que se fueron.",
    ],
  },
  {
    title: "Poemas para leer en pantuflas",
    author: "Varios autores de la casa",
    kind: "poemas",
    blurb: "Se recomienda leerlo con los pies calientes.",
    pages: [
      "Lunes\n\nEl lunes llegó temprano\ncon su maletín de frío.\nLe ofrecí una silla, un tinto,\ny se quedó, el muy tardío,\n\nhasta que dieron las seis\ny se fue sin despedirse.\nLos lunes nunca aprenden\ncómo ni cuándo irse.",
      "Pantuflas\n\nTengo unas pantuflas viejas\ncon forma de mis dos pies;\nsaben de memoria el camino\nde la cama a la cocina\ny de la cocina otra vez.\n\nNo las cambio por zapatos\nni por botas de charol:\nellas me llevan despacio,\ncomo camina el sol.",
      "Lluvia en el techo\n\nLlueve sobre las tejas\ncomo quien toca una puerta\nsin querer que le abran:\nsolo avisar que está afuera.\n\nY uno, adentro, con la cobija,\nle contesta en voz bajita:\n«Ya te oí. Quédate un rato.\nNo hay afán. La casa es tuya.»",
      "Buenas noches\n\nSe apagan las lámparas\nuna por una en el pasillo.\nEl reloj de pie bosteza\nsus doce golpes sencillos.\n\nQue duerman bien las plantas,\nel gato, el fuego, el café.\nMañana nos vemos todos.\nMañana, a la misma hora. Ya ves.",
    ],
  },
  {
    title: "Guía de aves del jardín",
    author: "Rosa Emilia Duarte",
    kind: "guía",
    blurb: "Con apuntes tomados desde la banca del jardín.",
    pages: [
      "El copetón\n\nPequeño, café, con un copete que parece recién peinado con los dedos. Canta temprano, siempre la misma frase, como si tuviera algo importante que recordarnos.\n\nNo le tiene miedo a nadie. Se posa en la mesa del jardín si hay migas y a veces aunque no haya.",
      "El colibrí\n\nNo se le ve llegar: aparece. Queda suspendido frente a la flor como un pensamiento que no termina de decidirse, y se va.\n\nConsejo de observación: no lo persiga con la mirada. Espere quieto junto a los arbustos en flor. Él vuelve siempre al mismo sitio.",
      "La mirla\n\nNegra, de pico amarillo, camina por el césped con aire de inspectora. Se detiene, inclina la cabeza, escucha la tierra y saca una lombriz. Parece magia; es paciencia.\n\nCanta al atardecer, desde lo alto de un pino. Si la oye, deje lo que esté haciendo un minuto.",
      "Apunte final\n\nEn este jardín no hay aves raras. Hay aves de todos los días, que es mejor: se las puede conocer por su nombre, saber a qué hora vienen, extrañarlas cuando no están.\n\nLa guía queda abierta. Si ve una que no está aquí, escríbala en la última página.",
    ],
  },
  {
    title: "El último tren a Villa Musgo",
    author: "Gregorio Salcedo",
    kind: "cuento",
    blurb: "Una novela corta de misterio (muy corta).",
    pages: [
      "El tren salía a las once y cuarenta de la noche, y nunca llevaba a más de tres pasajeros. Esa noche llevaba a cuatro.\n\nEl conductor contó dos veces. Una señora con un canasto, un niño con una bufanda roja, un señor dormido. Y, en el último vagón, alguien con un sombrero que no dejaba verle la cara.",
      "En la estación de Villa Musgo solo se bajaron tres. El conductor recorrió los vagones con su linterna: vacíos. Encima del último asiento había un sombrero y, debajo, una nota escrita a mano.\n\n«Gracias por el viaje. Hacía años que quería volver.»",
      "Al día siguiente, el conductor preguntó en el pueblo. La señora del canasto le dijo que no había visto a nadie. El niño de la bufanda, en cambio, sonrió.\n\n—Es mi abuelo —dijo—. Viaja una vez al año, el día de su cumpleaños. Siempre deja el sombrero para que sepamos que vino.",
      "El conductor guardó el sombrero en la estación, en un gancho junto al reloj. Todavía está ahí.\n\nY todos los años, la misma noche, el tren sale con un vagón de más encendido, aunque nadie lo haya pedido. El conductor dice que es costumbre. Nadie le pregunta más.",
    ],
  },
  {
    title: "Cómo hablarle a las plantas",
    author: "Fernanda Quiroga",
    kind: "guía",
    blurb: "Conversaciones que dan hojas nuevas.",
    pages: [
      "Principio básico\n\nLas plantas no entienden las palabras; entienden el tono. Hábleles como le hablaría a alguien que quiere y que acaba de despertarse.\n\nEvite discutir cerca de ellas. Los helechos, sobre todo, se toman todo personal.",
      "Temas que les gustan\n\n· El clima (les interesa mucho, por razones obvias).\n· Cómo le fue en el día.\n· Chismes suaves de la casa.\n· Canciones viejas, tarareadas.\n\nTemas que conviene evitar: las podadoras, el invierno, la vecina que tiene plantas más grandes.",
      "Por especie\n\nLa monstera: halágela. Es vanidosa y lo sabe.\nEl cactus: no insista. Prefiere el silencio y la luz.\nLa orquídea: háblele poco y bonito, como en una carta.\nEl bonsái: háblele de usted. Es mayor de lo que parece.",
      "Última recomendación\n\nEscuche también. Una planta que se inclina hacia la ventana está pidiendo luz. Una hoja amarilla es un «así no». Un brote nuevo es un «gracias».\n\nLa conversación con una planta es lenta. Tiene la velocidad exacta que necesitamos, a veces.",
    ],
  },
  {
    title: "Atlas de islas que no existen",
    author: "Capitán Ignacio Vela",
    kind: "guía",
    blurb: "Cartografía de lo que nadie ha visto.",
    pages: [
      "Isla Domingo\n\nAparece solo los domingos por la tarde, a unos diez minutos de distancia de donde uno esté. Tiene una hamaca, una palmera y ninguna notificación.\n\nNo se llega navegando. Se llega cerrando los ojos después del almuerzo.",
      "Archipiélago de las Llaves\n\nAquí van a parar las llaves que uno busca por toda la casa. Cada isla tiene una puerta que ya nadie recuerda.\n\nLos habitantes son amables, pero no devuelven nada. Dicen que las llaves están mejor así, sin tener que abrir cosas todo el día.",
      "Isla del Mensaje Sin Enviar\n\nNiebla espesa, costas tímidas. Ahí flotan los mensajes que escribimos y no mandamos: disculpas, «te extraño», «¿cómo estás?».\n\nEl capitán recomienda no quedarse mucho. Y, a la vuelta, mandar al menos uno.",
      "Nota del cartógrafo\n\nEste atlas está incompleto a propósito. Cada lector tiene sus islas que no existen, y sabe perfectamente dónde quedan.\n\nDibuje la suya en el margen. No hace falta brújula: basta saber qué se extraña.",
    ],
  },
  {
    title: "Pequeño tratado de siestas",
    author: "Dormilio Bastidas",
    kind: "guía",
    blurb: "Obra escrita en varias sesiones, con pausas.",
    pages: [
      "La siesta corta\n\nVeinte minutos, sentado, con la cabeza apoyada donde se pueda. Se despierta uno sin saber qué día es, pero con la certeza de que el mundo es un lugar mejor.\n\nIdeal después del almuerzo o de una reunión que pudo ser un correo.",
      "La siesta de sofá\n\nSe empieza «viendo algo» en la tele. A los diez minutos, la tele lo está viendo a uno. Se despierta con la marca del cojín en la mejilla.\n\nEs la más honesta de las siestas: nunca fue planeada.",
      "La siesta prohibida\n\nLas cinco de la tarde. Uno sabe que no debe. Uno sabe que en la noche no va a poder dormir. Uno cierra los ojos «solo un momentico».\n\nEl autor no la recomienda. El autor la practica con frecuencia.",
      "Epílogo\n\nEste tratado debía tener doce capítulos. El autor se quedó dormido escribiendo el quinto y decidió que era una señal.\n\nSi usted llegó hasta aquí despierto, felicitaciones. Ahora cierre el libro y descanse un poco. Se lo ganó.",
    ],
  },
  {
    title: "El misterio del reloj de pie",
    author: "Aurora Benavides",
    kind: "cuento",
    blurb: "Un caso para resolver en la sala de estar.",
    pages: [
      "El reloj de pie del salón daba trece campanadas a la medianoche. No doce: trece. Todos en la casa lo habían notado y nadie decía nada, por educación.\n\nHasta que llegó una persona nueva al equipo, de esas que preguntan todo, y preguntó.",
      "—¿Por qué da trece?\n\nSe miraron entre todos. Alguien dijo que era un defecto de fábrica. Otro, que era por la humedad. El gato se fue de la habitación, cosa sospechosa.\n\nEsa noche, la persona nueva se quedó despierta junto al reloj, con una aromática y una linterna.",
      "A las doce en punto, sonaron doce campanadas. Y entonces, desde adentro del reloj, una vocecita dijo: «Y una más, por los que se quedaron trabajando tarde».\n\nLa decimotercera sonó despacito, casi como un bostezo.",
      "Al otro día nadie le creyó. Pero desde entonces, cuando alguien se queda hasta tarde en la cabaña, el reloj espera a que se vaya antes de dar la última.\n\nY, si uno escucha con atención, suena un poco más contenta.",
    ],
  },
  {
    title: "Canciones para una tarde de lluvia",
    author: "Julián Montes",
    kind: "poemas",
    blurb: "Letras sin música; la lluvia pone el ritmo.",
    pages: [
      "Primera canción\n\nPlic, en la ventana,\nplac, en el balcón,\nla lluvia está ensayando\nsu nueva canción.\n\nNo tiene partitura,\nno tiene afinación,\npero nadie en el barrio\nle pide perdón.",
      "Segunda canción\n\nSe mojó el jardín entero,\nse mojó el tendedero,\nse mojó el perro, que vino\na secarse en mi sombrero.\n\nY yo, que tenía prisa,\nme senté a ver llover:\nhay tardes que se hicieron\npara no hacer.",
      "Tercera canción\n\nCuando escampe, saldremos\na buscar charcos grandes,\na ver el cielo al revés\nentre las piedras y el musgo.\n\nPero todavía no.\nTodavía llueve un poco.\nPon otra vez el agua\npara el tinto, que no hay apuro.",
      "Última canción\n\nSe fue la lluvia sin ruido,\ncomo se van las visitas\nque ya son de la casa\ny no se despiden.\n\nQuedó el olor a tierra,\nquedó el vidrio empañado,\nquedó esta canción\na medio terminar, a tu lado.",
    ],
  },
  {
    title: "Carta con olor a lluvia",
    author: "Juan Ordoñez",
    kind: "carta",
    blurb: "Escrita a mano, una noche de lluvia y café frío.",
    pages: [
      "Lo escribo a mano porque usted merece la imperfección de la letra.\n\nEsta noche huele a lluvia y a café frío, y hay algo en esa combinación de cosas ordinarias que me recuerda que tengo algo guardado demasiado tiempo, algo que necesita salir antes de que encuentre otra forma de hacerlo.",
      "Soy alguien que escribe como autopsia, que convierte las emociones en texto para poder mirarlas desde afuera sin que lo quemen. Pero esta vez no quiero eso. Esta vez quiero decirle sin peso, sin el andamiaje de mis dudas, sin convertir lo que tenemos en un problema que resolver.",
      "Y si algo me ayuda a intentarlo, son esos ojos suyos que no me dan tregua, esos ojos que cuando se fijan en mí hacen que todo lo que creía saber sobre estar tranquilo se vuelva una hipótesis sin sustento.\n\nPorque usted no llegó despacio.",
      "Llegó como se recuerda algo que nunca se vivió, como la certeza extraña de reconocer una voz que no había escuchado antes. Y yo, que había amoblado mi soledad con libros y silencios que me bastaban, me encontré de pronto queriendo contarle que llovía, que el café estaba frío, que la luna no me sonrió como cada noche.",
      "Cosas mínimas que antes no le decía a nadie, y que ahora solo tienen sentido si se las digo a usted.\n\nEl miedo existe, y no voy a fingir que no. No el miedo elegante que suena bien en las cartas, sino ese otro más viejo y más feo, el que aprendí de niño y que todavía a veces me despierta antes que el sol.",
      "El miedo a que algo que importa desaparezca sin aviso, a extender la mano y encontrar aire donde antes había alguien. No se lo cuento para que la cargue, ni para que sienta que tiene una deuda con mi historia.",
      "Se lo cuento porque usted ya lo conoce sin que yo se lo haya dicho, porque lo habrá visto vivir en algún gesto mío que no supe disimular. Y aun así se quedó. Eso, para mí, no es un detalle menor.\n\nQuiero construir con usted despacio. Sin prisa. Sin miedo a que lo despacio signifique menos.",
      "Y eso, para alguien como yo, no es una frase. Es casi todo.",
    ],
  },
];

const BY_TITLE = new Map(BOOKS.map((b) => [b.title, b]));

/** El libro de esa semilla (la misma que elige el título del globo: `bookTitle`). */
export function bookOf(seed: number): Book {
  const title = BOOK_TITLES[Math.abs(Math.floor(seed)) % BOOK_TITLES.length]!;
  return BY_TITLE.get(title) ?? BOOKS[0]!;
}
