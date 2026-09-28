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

let warmed = false;

/**
 * Adelanta la bajada del arte del juego (el manifiesto, el atlas de muebles, el bosque y el fondo del
 * jardín, donde se entra) mientras se conecta y se baja el motor: cuando el cargador de Phaser los pida,
 * ya están en la caché del navegador. Los demás niveles los baja el cargador como siempre. Sin await: si
 * algo falla, el cargador los vuelve a pedir.
 */
export function warmPrerender(spawnArea = "jardin") {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  const get = (file: string) => fetch(`${PRERENDER_DIR}/${file}`).catch(() => null);
  void get(GAME_MANIFEST)
    .then((r) => (r?.ok ? (r.json() as Promise<{ version: string; areas: Record<string, { dia: string }>; atlases: string[]; surroundings: Record<string, string> }>) : null))
    .then((m) => {
      if (!m) return;
      const files = [...m.atlases, ...Object.values(m.surroundings), m.areas[spawnArea]?.dia].filter((f): f is string => Boolean(f));
      for (const f of files) void get(`${f}?v=${m.version}`).then((r) => r?.blob());
    })
    .catch(() => undefined);
}
