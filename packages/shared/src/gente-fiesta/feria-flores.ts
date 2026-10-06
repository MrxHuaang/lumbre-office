// La gente de la Feria de las flores (VIR-167): los silleteros que pasean frente a los exhibidores del
// patio, la florista del puesto (abre el puesto de las semillas y pide girasoles), los turistas que toman
// fotos, los abuelos que admiran las silletas y el tiple de fondo. Todo en tiles del jardín.
import type { FiestaNpc } from "../gente-fiesta";
import { canelo, papel, suelto } from "./comun";

const F = "feria-flores";
/** Frente a los exhibidores: los silleteros se paran a mirar cada silleta. */
const EXHIBIDORES = [
  { x: 76, y: 51, mira: "up", pausa: 2 },
  { x: 85, y: 51, mira: "up", pausa: 2 },
  { x: 93, y: 51, mira: "up", pausa: 2 },
  { x: 93, y: 56 },
  { x: 74, y: 56 },
] as const;
/** El traje de silletero: camisa blanca, pantalón oscuro, sombrero aguadeño y la silleta a la espalda. */
const SILLETERO = { top: "dress-shirt" as const, shirt: "#f4f0e6", pants: "#2a2430", head: "straw-hat" as const, neck: "neckerchief" as const, accent: "#c03a3a", back: "backpack" as const };

export function GENTE_FERIA(): FiestaNpc[] {
  return [
    papel(F, "rubiela", {
      rol: "La florista del puesto",
      area: "jardin",
      tile: { x: 83, y: 52 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { outfit: "apron", shirt: "#e8c03a", head: "flower", accent: "#e05a7a" },
      accion: { tipo: "puesto" },
      lluvia: "sigue",
      frases: {
        hola: ["¡Semillas de flores pa' la silleta! Claveles, astromelias, girasoles…", "Una silleta buena lleva flores de tres colores, por lo menos.", "Estas semillas son de Santa Elena, de la tierrita de los silleteros."],
        tarde: ["Ya se me acabaron los girasoles. ¿Usted no tiene en el huerto?"],
      },
      murmullos: ["¡Semillas de flores!", "Claveles, astromelias…", "Pa' la silleta, mijo"],
      pedido: {
        id: "girasoles-rubiela",
        pide: [{ item: "girasol", n: 3 }],
        da: { puntos: 10 },
        texto: "Se me acabaron los girasoles del puesto. ¿Me trae tres del huerto? Se los pago bien.",
        gracias: "¡Qué girasoles tan bonitos! Con estos armo la silleta más alegre de la feria.",
      },
    }),
    papel(F, "ramiro", {
      rol: "Silletero de la vereda",
      area: "jardin",
      tile: { x: 76, y: 51 },
      comportamiento: { tipo: "ronda", paradas: EXHIBIDORES },
      pinta: SILLETERO,
      frases: {
        hola: ["Cargo silleta desde los doce años. La espalda se acostumbra; las flores, no se cansan.", "Una silleta tradicional lleva las flores en círculos. Las modernas, lo que uno sueñe."],
      },
      murmullos: ["Qué silleta tan buena", "Esa lleva hortensias", "Derechito, la espalda"],
      pedido: {
        id: "hortensias-ramiro",
        pide: [{ item: "hortensia", n: 2 }],
        da: { puntos: 8 },
        texto: "A mi silleta le faltan dos hortensias pa' el centro. ¿Me las trae del huerto?",
        gracias: "Ahora sí quedó completa. Dios le pague, que esta silleta va al desfile.",
      },
    }),
    suelto(F, "abelardo", "Don Abelardo", { skin: "#d9a066", hair: "#d8d4ce", hairStyle: "short", facialHair: "mustache", ...SILLETERO }, {
      rol: "Silletero de Santa Elena",
      area: "jardin",
      tile: { x: 93, y: 56 },
      comportamiento: { tipo: "ronda", paradas: [...EXHIBIDORES].reverse() },
      voz: 0.28,
      frases: { hola: ["Vengo de Santa Elena, de cinco generaciones de silleteros.", "La silleta nació pa' cargar flores al mercado. Ahora es un orgullo.", "Mire bien las silletas: cada flor tiene su lugar."] },
      murmullos: ["Cinco generaciones…", "¡Qué colores!", "Esa es emblemática"],
    }),
    suelto(F, "camila", "Camila", { skin: "#ffdbac", hair: "#d8a050", shirt: "#3aa0d0", pants: "#e8e4dc", accent: "#2a2a3a", hairStyle: "ponytail", top: "tshirt", bottom: "shorts", head: "bucket-hat", face: "sunglasses", shoes: "sandals", shoeColor: "#8a5a3a" }, {
      rol: "Turista que toma fotos",
      area: "jardin",
      tile: { x: 80, y: 57 },
      comportamiento: { tipo: "deambula", zona: { x: 70, y: 44, w: 26, h: 16 }, paradas: 6, pausa: 1.5 },
      fotos: true,
      voz: 0.7,
      frases: { hola: ["¡Qué belleza de silletas! Vine desde Bogotá solo a verlas.", "¿Me toma una foto con esa silleta? Bueno, mejor yo se la tomo a usted.", "Ya llené la memoria del celular. Y apenas es mediodía."] },
      murmullos: ["¡Foto, foto!", "Qué colores…", "Una más"],
    }),
    suelto(F, "andres", "Andrés", { skin: "#8d5524", hair: "#1b1b1b", shirt: "#e8a03a", pants: "#3a4a6a", accent: "#2a2a3a", hairStyle: "afro", top: "hawaiian", bottom: "cargo", face: "sunglasses", back: "backpack", shoes: "sneakers", shoeColor: "#e8e4dc" }, {
      rol: "Turista que toma fotos",
      area: "jardin",
      tile: { x: 90, y: 58 },
      comportamiento: { tipo: "deambula", zona: { x: 70, y: 44, w: 26, h: 16 }, paradas: 6, pausa: 1.8 },
      fotos: true,
      voz: 0.42,
      frases: { hola: ["Primera vez en la feria. ¡Hasta las silletas tienen nombre!", "Me dijeron que el desfile es lo mejor. ¿A qué hora pasa?", "Esta foto va derecho de fondo de pantalla."] },
      murmullos: ["¡Increíble!", "Panorámica…", "Sonría"],
    }),
    papel(F, "valentina", {
      rol: "Transmite la feria en vivo",
      area: "jardin",
      tile: { x: 90, y: 46 },
      comportamiento: { tipo: "quieto", mira: "down" },
      pinta: { head: "flower", accent: "#e05a7a" },
      fotos: true,
      frases: { hola: ["Estoy en vivo desde la feria, ¡salude!", "La silleta del exhibidor tres va ganando en mis comentarios."] },
      murmullos: ["¡Estamos en vivo!", "Denle like", "Miren esta silleta"],
    }),
    papel(F, "marina", {
      rol: "Admira las silletas",
      area: "jardin",
      tile: { x: 87, y: 57 },
      comportamiento: { tipo: "grupo", grupo: "admiran", centro: { x: 88, y: 57 } },
      pinta: { head: "flower", accent: "#e0a23a" },
      frases: { hola: ["La Feria de las flores empezó en 1957, mijo. Eso no se lo enseñan en ningún lado.", "Las silletas emblemáticas llevan mensajes. Las tradicionales, puro color."] },
      murmullos: ["En 1957…", "Eso no es así", "Qué arreglo tan fino"],
    }),
    papel(F, "carmenza", {
      rol: "Admira las silletas",
      area: "jardin",
      tile: { x: 89, y: 57 },
      comportamiento: { tipo: "grupo", grupo: "admiran", centro: { x: 88, y: 57 } },
      frases: { hola: ["Yo cargué silleta de joven. Una chiquita, pero pesaba como una grande.", "Ese clavel está mal puesto. No diga que yo dije."] },
      murmullos: ["Ese clavel…", "¡Ay, qué lindo!", "Yo cargué una"],
    }),
    papel(F, "aurelio", {
      rol: "Admira las silletas",
      area: "jardin",
      tile: { x: 88, y: 58 },
      comportamiento: { tipo: "grupo", grupo: "admiran", centro: { x: 88, y: 57 } },
      pinta: { neck: "neckerchief", accent: "#c03a3a" },
      frases: { hola: ["Carmenza dice que cargó silleta. Yo la cargué a ella en el desfile.", "Con este solecito hasta las flores bailan."] },
      murmullos: ["¡Bravo!", "Qué solecito", "Eso, Carmenza"],
    }),
    papel(F, "tomas", {
      rol: "Toca bambucos junto al puesto",
      area: "jardin",
      tile: { x: 73, y: 51 },
      comportamiento: { tipo: "quieto", mira: "right" },
      frases: { hola: ["Pa' la feria, bambucos y pasillos. Esta la compuse anoche.", "La silleta y el tiple: lo más paisa que hay."] },
      murmullos: ["Tlin, tlan…", "Un pasillo", "¡Que viva la feria!"],
    }),
    papel(F, "mariana", {
      rol: "Pasea entre las flores",
      area: "jardin",
      tile: { x: 78, y: 58 },
      comportamiento: { tipo: "deambula", zona: { x: 70, y: 50, w: 26, h: 10 }, paradas: 5, pausa: 1 },
      pinta: { head: "flower", accent: "#e8c03a" },
      frases: { hola: ["¡Cuando sea grande voy a cargar una silleta gigante!", "Canelo se quiso comer un clavel. Lo regañé."] },
      murmullos: ["¡Qué flores!", "¡Canelo, no!", "Huele rico"],
    }),
    canelo(F, `${F}:mariana`, { x: 77, y: 58 }),
    papel(F, "efrain", {
      rol: "Vende empanadas en la feria",
      area: "jardin",
      tile: { x: 70, y: 56 },
      comportamiento: { tipo: "quieto", mira: "right" },
      frases: { hola: ["¡Empanadas paisas con ají de la feria!", "Las flores no se comen. Las empanadas sí. Ahí está la diferencia."] },
      murmullos: ["¡Empanadas paisas!", "Con ají de la feria", "¡Calienticas!"],
    }),
  ];
}
