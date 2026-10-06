// Dormir en una cama hace amanecer (VIR-144; reglas en dormir.ts de @hyvento/shared, sala en
// apps/server/src/rooms/dormir.ts). Aquí: dónde va el cuerpo acostado (`sitioDeCama`), cuántos duermen para
// el letrero "Durmiendo 2/4" y el amanecer (fundido y aviso).
import { AMANECIO_TEXTO, DORMIR_AVISO_TEXT, DORMIR_MSG, type DormirAvisoCode, type DormirEstado } from "@hyvento/shared";
import { create } from "zustand";
import type { OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

export { sitioDeCama } from "@/lib/camas";

interface DormirStore {
  estado: DormirEstado | null;
  /** Cuándo amaneció por última vez (performance.now()): el fundido lo dibuja `DormirOverlay`. */
  amanecioAt: number;
}

export const useDormirStore = create<DormirStore>(() => ({ estado: null, amanecioAt: 0 }));

export function bindDormir(r: OfficeRoom) {
  r.onMessage(DORMIR_MSG.estado, (e: DormirEstado) => useDormirStore.setState({ estado: e }));
  r.onMessage(DORMIR_MSG.aviso, (a: { code: DormirAvisoCode }) => useOfficeStore.getState().notify(DORMIR_AVISO_TEXT[a.code] ?? "", "info"));
  r.onMessage(DORMIR_MSG.amanecio, () => {
    useDormirStore.setState({ amanecioAt: performance.now() });
    useOfficeStore.getState().notify(AMANECIO_TEXTO, "success");
  });
}
