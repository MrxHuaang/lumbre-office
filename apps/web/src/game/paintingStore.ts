// Los cuadros de la Pintura ya pedidos a /api/paintings/<id> (no cambian nunca, así que se guardan en
// memoria). Sin Phaser: lo usan también la app del PC y el panel de decorar, que se dibujan en el servidor.
import type { PaintingDTO } from "@hyvento/shared";
import { create } from "zustand";

interface PaintingState {
  /** Cuadros ya pedidos: el cuadro, o null si no existe (lo borraron) o no cargó. */
  byId: Record<string, PaintingDTO | null>;
  /** Pide un cuadro si no se había pedido (lo llama quien lo necesita dibujar). */
  request: (id: string) => void;
  /** Guarda uno que ya se tiene (el que se acaba de pintar), sin pedirlo. */
  remember: (p: PaintingDTO) => void;
}

const pending = new Set<string>();

export const usePaintingStore = create<PaintingState>((set, get) => ({
  byId: {},
  request(id) {
    if (id in get().byId || pending.has(id)) return;
    pending.add(id);
    fetch(`/api/paintings/${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { painting: PaintingDTO }).painting : null))
      .catch(() => null)
      .then((p) => {
        pending.delete(id);
        set((s) => ({ byId: { ...s.byId, [id]: p } }));
      });
  },
  remember(p) {
    set((s) => ({ byId: { ...s.byId, [p.id]: p } }));
  },
}));
