// El acuario de la sala: nadan los peces que sacó el equipo del lago (la variedad del álbum de todos).
// La lista sale de GET /api/aquarium (agrupada por especie, con quién los atrapó); aquí se decide cuáles
// nadan cuando hay más especies que lugar: primero los más raros y, entre iguales, los más recientes.
import { fishById, isTrash, type FishRarity } from "./fishing";

export const AQUARIUM = {
  /** Peces que nadan a la vez en un acuario (el del salón o uno comprado para una oficina). */
  maxFish: 6,
  /** Personas que se muestran por especie en el panel (las que más sacaron). */
  catchersShown: 4,
} as const;

/** Quién sacó una especie y cuántas veces. */
export interface FishCatcher {
  name: string;
  count: number;
}

/** Un renglón del álbum del equipo (GET /api/aquarium). */
export interface TeamFishEntry {
  species: string;
  /** Cuántas veces la sacó el equipo. */
  count: number;
  /** El más grande (cm) y quién lo sacó. */
  best: number;
  bestBy: string;
  /** Quienes la sacaron, de más a menos veces (a lo sumo `AQUARIUM.catchersShown`). */
  catchers: FishCatcher[];
  /** Cuántas personas distintas la sacaron. */
  people: number;
  lastAt: string;
}

/** Mítico = 0, legendario = 1… (para ordenar de lo más raro a lo más común). */
const RARITY_RANK: Record<FishRarity, number> = { mitico: 0, legendario: 1, epico: 2, raro: 3, "poco-comun": 4, comun: 5, basura: 6 };
const rarityRank = (r: FishRarity) => RARITY_RANK[r];

/** Solo peces de verdad y del catálogo actual (la basura no va al acuario). */
export function aquariumEntries(entries: readonly TeamFishEntry[]): TeamFishEntry[] {
  return entries
    .filter((e) => {
      const f = fishById(e.species);
      return f && !isTrash(f) && e.count > 0;
    })
    .sort((a, b) => {
      const ra = rarityRank(fishById(a.species)!.rarity);
      const rb = rarityRank(fishById(b.species)!.rarity);
      if (ra !== rb) return ra - rb;
      const t = new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
      return t !== 0 ? t : a.species.localeCompare(b.species);
    });
}

/** Las especies que nadan en el acuario (a lo sumo `max`). */
export function pickAquariumFish(entries: readonly TeamFishEntry[], max: number = AQUARIUM.maxFish): string[] {
  return aquariumEntries(entries)
    .slice(0, Math.max(0, max))
    .map((e) => e.species);
}
