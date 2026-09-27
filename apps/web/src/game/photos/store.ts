// Estado de las fotos en el cliente: la lista del tablón (se pide a /api/photos y se vuelve a pedir cuando
// el servidor avisa que cambió), la foto recién sacada que falta subir y el flash de la pantalla.
import { PHOTO_ERROR_TEXT, type PhotoDTO, type PhotoError, type PhotoPerson } from "@hyvento/shared";
import { create } from "zustand";

/** La foto recién sacada: el recorte del canvas y lo que dijo el servidor (el ticket vence en 5 min). */
export interface PendingPhoto {
  id: number;
  shot: HTMLCanvasElement;
  ticket: string;
  area: string;
  people: PhotoPerson[];
  takenAt: number;
}

interface PhotoStore {
  photos: PhotoDTO[];
  /** Ya se pidió la lista (si no, el tablón la pide al verse). */
  loaded: boolean;
  /** Error de la última carga (para la galería). */
  error: string | null;
  pending: PendingPhoto | null;
  /** Cuándo fue el último flash de mi cámara (la capa blanca de la pantalla lo mira). */
  flashAt: number;
  /** Hasta cuándo corre mi cuenta regresiva (el botón queda esperando). */
  countingUntil: number;
  refresh: () => Promise<void>;
  /** El servidor avisó que cambió: se vuelve a pedir solo si alguien la está mirando. */
  markStale: (reload: boolean) => void;
  setPending: (p: Omit<PendingPhoto, "id"> | null) => void;
  flash: () => void;
  setCounting: (until: number) => void;
  /** Quitar una foto de la lista sin esperar a la red (después de borrarla). */
  drop: (id: string) => void;
  replace: (photo: PhotoDTO) => void;
}

let inFlight: Promise<void> | null = null;
let again = false;
let pendingId = 0;

/** Texto de un error de la API de fotos (la respuesta trae `code` y un `error` legible). */
export function photoErrorText(body: { error?: string; code?: string } | null, fallback = "Algo salió mal. Intenta de nuevo.") {
  if (body?.code && body.code in PHOTO_ERROR_TEXT) return PHOTO_ERROR_TEXT[body.code as PhotoError];
  return body?.error ?? fallback;
}

export const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  loaded: false,
  error: null,
  pending: null,
  flashAt: 0,
  countingUntil: 0,
  refresh: async () => {
    // Si llega otro aviso mientras se carga, se pide una vez más al terminar (no en paralelo).
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        again = false;
        try {
          const res = await fetch("/api/photos", { cache: "no-store" });
          const body = (await res.json().catch(() => null)) as { photos?: PhotoDTO[]; error?: string; code?: string } | null;
          if (!res.ok || !body?.photos) throw new Error(photoErrorText(body, "No se pudieron cargar las fotos."));
          set({ photos: body.photos, loaded: true, error: null });
        } catch (err) {
          set({ loaded: true, error: err instanceof Error ? err.message : String(err) });
        }
      } while (again);
    })();
    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  },
  markStale: (reload) => {
    if (reload) void get().refresh();
    else set({ loaded: false });
  },
  setPending: (p) => set({ pending: p ? { ...p, id: ++pendingId } : null }),
  flash: () => set({ flashAt: Date.now() }),
  setCounting: (until) => set({ countingUntil: until }),
  drop: (id) => set({ photos: get().photos.filter((p) => p.id !== id) }),
  replace: (photo) => set({ photos: get().photos.map((p) => (p.id === photo.id ? photo : p)) }),
}));

/** URL de la imagen de una foto (el navegador la guarda: nunca cambia). */
export const photoImageUrl = (id: string) => `/api/photos/${encodeURIComponent(id)}/image`;
