// Los vecinos de la vereda (VIR-167): personajes ficticios y recurrentes que llegan a cada festival con otro
// papel y otra pinta (disfraz en brujas, ruana en velitas, ropa de fiesta en el carnaval…), para que la
// cabaña se sienta como un pueblo. Cada uno tiene su pinta base; un festival la cambia con `vestirVecino`,
// que nunca toca la piel (respeto cultural: en el carnaval el blanco y negro va en la ropa, como en los
// avatares).
import type { Look } from "../look";

export const VECINO_IDS = [
  "marina",
  "efrain",
  "mariana",
  "aurelio",
  "carmenza",
  "tomas",
  "chepe",
  "luzdary",
  "valentina",
  "santiago",
  "rubiela",
  "fredy",
  "ramiro",
] as const;
export type VecinoId = (typeof VECINO_IDS)[number];

export interface Vecino {
  id: VecinoId;
  nombre: string;
  edad: number;
  oficio: string;
  personalidad: string;
  /** Lo que siempre dice. */
  frase: string;
  look: Look;
  /** Tono de la voz en el diálogo (0 grave .. 1 agudo). */
  voz: number;
}

const look = (l: Omit<Look, "accessories">): Look => ({ accessories: [], ...l });

export const VECINOS: Readonly<Record<VecinoId, Vecino>> = {
  marina: {
    id: "marina",
    nombre: "Profe Marina",
    edad: 71,
    oficio: "Maestra jubilada",
    personalidad: "Lo sabe todo y corrige con cariño; enseñó a leer a media vereda.",
    frase: "Eso no es así, mijo. Siéntese que le explico.",
    voz: 0.62,
    look: look({ skin: "#e0ac69", hair: "#d8d4ce", shirt: "#5a6b8a", pants: "#3e3a4a", accent: "#c2554a", hairStyle: "bun", top: "cardigan", bottom: "long-skirt", face: "round-glasses", neck: "pearls", eyes: "happy", shoes: "dress-shoes", shoeColor: "#4a2e20" }),
  },
  efrain: {
    id: "efrain",
    nombre: "Don Efraín",
    edad: 58,
    oficio: "Vende empanadas",
    personalidad: "Bonachón y conversador; regatea hasta lo que regala.",
    frase: "¡Empanadas calienticas, con ají de la casa!",
    voz: 0.3,
    look: look({ skin: "#c68642", hair: "#2a2420", shirt: "#e8e0d0", pants: "#3a3a48", accent: "#b8402e", hairStyle: "short", facialHair: "mustache", outfit: "apron", head: "cap", shoes: "boots", shoeColor: "#2a1a10" }),
  },
  mariana: {
    id: "mariana",
    nombre: "Mariana",
    edad: 9,
    oficio: "Estudiante de cuarto",
    personalidad: "Curiosa y preguntona; no va a ningún lado sin Canelo, su perro.",
    frase: "¡Canelo, vuelva acá!",
    voz: 0.92,
    look: look({ skin: "#8d5524", hair: "#1b1b1b", shirt: "#f2c84a", pants: "#3a6ab0", accent: "#e05a7a", hairStyle: "pigtails", top: "tshirt", bottom: "skirt", head: "bow", eyes: "big", shoes: "sneakers", shoeColor: "#e8e4dc" }),
  },
  aurelio: {
    id: "aurelio",
    nombre: "Don Aurelio",
    edad: 74,
    oficio: "Pensionado de los ferrocarriles",
    personalidad: "Bailarín de toda la vida; no se pierde una fiesta ni una pieza.",
    frase: "Esta pieza es mía, Carmenza.",
    voz: 0.24,
    look: look({ skin: "#f1c27d", hair: "#ece8e2", shirt: "#f4ecdc", pants: "#4a3a2e", accent: "#7a2a36", hairStyle: "side-part", facialHair: "mustache", top: "dress-shirt", head: "straw-hat", shoes: "dress-shoes", shoeColor: "#2a1a10" }),
  },
  carmenza: {
    id: "carmenza",
    nombre: "Doña Carmenza",
    edad: 72,
    oficio: "Modista",
    personalidad: "Coqueta y mandona; le cose los trajes de fiesta a todo el pueblo.",
    frase: "¡Aurelio, no me pise!",
    voz: 0.7,
    look: look({ skin: "#e0ac69", hair: "#b8b2ac", shirt: "#c04a6a", pants: "#4a3040", accent: "#f2c84a", hairStyle: "curly", outfit: "dress", head: "flower", blush: true, eyes: "happy", shoes: "heels", shoeColor: "#5a2030" }),
  },
  tomas: {
    id: "tomas",
    nombre: "Tomás",
    edad: 34,
    oficio: "Músico de tiple",
    personalidad: "Soñador; toca bambucos y compone una canción para cada cosa.",
    frase: "Esta la compuse anoche.",
    voz: 0.45,
    look: look({ skin: "#d9a066", hair: "#3a2418", shirt: "#3a6a4a", pants: "#3a3040", accent: "#d8a94a", hairStyle: "long", facialHair: "beard", top: "flannel", top2: "#24402c", back: "guitar", shoes: "boots", shoeColor: "#4a3020" }),
  },
  chepe: {
    id: "chepe",
    nombre: "Chepe",
    edad: 45,
    oficio: "Mecánico",
    personalidad: "Chismoso y buena gente; sabe la vida de todos y la cuenta en voz baja.",
    frase: "¿Ya supo lo que pasó? Venga le cuento.",
    voz: 0.36,
    look: look({ skin: "#c8946a", hair: "#1f1a16", shirt: "#d8d0c0", pants: "#3a5a8a", accent: "#e0923e", hairStyle: "buzz", facialHair: "stubble", outfit: "coveralls", shoes: "boots", shoeColor: "#2a2020" }),
  },
  luzdary: {
    id: "luzdary",
    nombre: "Luz Dary",
    edad: 38,
    oficio: "Veterinaria",
    personalidad: "Práctica y cariñosa; conoce a todos los perros de la vereda por el nombre.",
    frase: "Los animales también se asustan con la pólvora.",
    voz: 0.58,
    look: look({ skin: "#a86b3c", hair: "#2a1810", shirt: "#4ab0a0", pants: "#33405a", accent: "#e8e4dc", hairStyle: "ponytail", top: "polo", neck: "stethoscope", shoes: "sneakers", shoeColor: "#e8e4dc" }),
  },
  valentina: {
    id: "valentina",
    nombre: "Valentina",
    edad: 16,
    oficio: "Estudiante y creadora de contenido",
    personalidad: "Todo lo graba; jura que va a ser famosa.",
    frase: "Espere, que estoy en vivo.",
    voz: 0.8,
    look: look({ skin: "#ffdbac", hair: "#6a3a1a", shirt: "#a07ad0", pants: "#2a2a3a", accent: "#f0f0f0", hairStyle: "wavy", top: "hoodie", bottom: "joggers", head: "headphones", shoes: "sneakers", shoeColor: "#f0f0f0" }),
  },
  santiago: {
    id: "santiago",
    nombre: "Santiago",
    edad: 15,
    oficio: "Estudiante",
    personalidad: "Primo de Valentina; pregunta por el wifi en todas partes.",
    frase: "¿Hay wifi aquí?",
    voz: 0.66,
    look: look({ skin: "#f1c27d", hair: "#2a2420", shirt: "#e05a3a", pants: "#4a5a3a", accent: "#2a2a3a", hairStyle: "undercut", top: "graphic-tee", bottom: "cargo", head: "cap", shoes: "sneakers", shoeColor: "#2a2a3a" }),
  },
  rubiela: {
    id: "rubiela",
    nombre: "Doña Rubiela",
    edad: 62,
    oficio: "Vende tamales",
    personalidad: "Madrugadora y generosa; sus tamales tienen fama en tres veredas.",
    frase: "Tamal tolimense, envuelto en hoja de plátano.",
    voz: 0.52,
    look: look({ skin: "#c68642", hair: "#3a2a20", shirt: "#3a7a5a", pants: "#3a3030", accent: "#e8c03a", hairStyle: "bun", outfit: "apron", neck: "scarf", head: "bandana", shoes: "slippers", shoeColor: "#5a3a2a" }),
  },
  fredy: {
    id: "fredy",
    nombre: "Fredy",
    edad: 41,
    oficio: "Ciclista aficionado",
    personalidad: "Madruga a subir el alto; mide todo en kilómetros.",
    frase: "Subí el alto antes del desayuno.",
    voz: 0.4,
    look: look({ skin: "#8d5524", hair: "#1b1b1b", shirt: "#e8c03a", pants: "#2a2a3a", accent: "#2a6ab0", hairStyle: "short", top: "jersey", bottom: "shorts", face: "sunglasses", head: "headband", shoes: "sneakers", shoeColor: "#2a6ab0" }),
  },
  ramiro: {
    id: "ramiro",
    nombre: "Don Ramiro",
    edad: 66,
    oficio: "Campesino",
    personalidad: "Paciente y de pocas palabras; baja de la loma con Paloma, su mula.",
    frase: "La tierra no tiene afán.",
    voz: 0.2,
    look: look({ skin: "#c8946a", hair: "#8a8680", shirt: "#8a6a4a", pants: "#4a3a2e", accent: "#4a3a2a", top2: "#4a3a2a", hairStyle: "short", facialHair: "mustache", outfit: "ruana", head: "straw-hat", shoes: "rain-boots", shoeColor: "#2a2a20" }),
  },
};

export const vecino = (id: VecinoId): Vecino => VECINOS[id];

/** Lo que un festival le puede cambiar a la pinta de un vecino: todo menos la piel. */
export type CambioDePinta = Omit<Partial<Look>, "skin">;

/** La pinta de un vecino con lo del festival encima (la piel queda siempre la suya). */
export function vestirVecino(id: VecinoId, cambios: CambioDePinta = {}): Look {
  const base = VECINOS[id].look;
  return { ...base, ...cambios, skin: base.skin, accessories: [] };
}
