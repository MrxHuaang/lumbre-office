// Logros en el cliente: los avisos de "¡Logro desbloqueado!" que están en pantalla y el perfil abierto
// (clic en alguien, en la lista de conectados o "Mi perfil" del menú).
import { create } from "zustand";

export interface AchievementToast {
  key: number;
  achievementId: string;
}

interface AchievementStore {
  toasts: AchievementToast[];
  /** userId del perfil abierto ("me" = el propio), o null. */
  profileId: string | null;
  /** Cambia cuando se desbloquea algo propio: el perfil abierto se vuelve a pedir. */
  version: number;
  pushToast: (achievementId: string) => void;
  dismissToast: (key: number) => void;
  openProfile: (userId: string) => void;
  closeProfile: () => void;
}

const TOAST_MS = 6000;
let nextKey = 0;

export const useAchievementStore = create<AchievementStore>((set, get) => ({
  toasts: [],
  profileId: null,
  version: 0,
  pushToast: (achievementId) => {
    const key = ++nextKey;
    // Como mucho tres a la vez: si se desbloquean varios juntos, se ven en fila.
    set((s) => ({ toasts: [...s.toasts.slice(-2), { key, achievementId }], version: s.version + 1 }));
    setTimeout(() => get().dismissToast(key), TOAST_MS);
  },
  dismissToast: (key) => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== key) })),
  openProfile: (profileId) => set({ profileId }),
  closeProfile: () => set({ profileId: null }),
}));
