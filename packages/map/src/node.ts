// Solo para Node (servidor de juego / worker): carga el mapa desde disco.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseOfficeMap, type OfficeMap } from "./index";
import type { TiledMap } from "./tiled";

export const OFFICE_MAP_PATH = fileURLToPath(new URL("../assets/office.json", import.meta.url));

export function loadOfficeMap(path = OFFICE_MAP_PATH): OfficeMap {
  return parseOfficeMap(JSON.parse(readFileSync(path, "utf8")) as TiledMap);
}
