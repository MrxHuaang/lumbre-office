// Dónde deja el build el arte pre-dibujado (scripts/prerender.ts). Sin imports: lo usa también la
// portada, que no debe cargar el motor de arte ni el mundo.

/** Carpeta de `public/` donde el build deja las imágenes (ignorada en git). */
export const PRERENDER_DIR = "/prerender";
/** Manifiesto del juego (qué imágenes hay y dónde cae el origen de cada una). */
export const GAME_MANIFEST = "juego.json";
/** Manifiesto de la portada (escena, dioramas, objetos y personajes). */
export const LANDING_MANIFEST = "portada.json";

/** Imagen recortada de la portada, con la esquina del recorte en el lienzo original. */
export interface LandingImage {
  src: string;
  w: number;
  h: number;
  x0: number;
  y0: number;
}

export interface LandingManifest {
  version: string;
  /** La casa del jardín (la escena viva), de día y de noche. */
  escena: { dia: LandingImage; noche: LandingImage };
  /** Las salas en miniatura, de día y de noche. */
  salas: Record<string, { dia: LandingImage; noche: LandingImage }>;
  /** Las cosas sueltas, por nombre. */
  objetos: Record<string, LandingImage>;
  /** Hojas de caminata de los personajes de la portada, por su clave (characterKey). */
  personajes: Record<string, string>;
  /** Luces de la escena (faroles y fogata), en tiles y alto. */
  luces: { x: number; y: number; z: number; color: string; radio: number; fuego: boolean }[];
  /** Medidas del cuadro del personaje (FRAME y FEET_Y del motor). */
  frame: number;
  feetY: number;
}
