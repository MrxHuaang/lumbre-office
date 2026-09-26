// Subconjunto del formato JSON de Tiled que usamos (https://doc.mapeditor.org/en/stable/reference/json-map-format/)

export interface TiledProperty {
  name: string;
  type: "bool" | "int" | "float" | "string" | "color" | "file" | "object" | "class";
  value: unknown;
}

export interface TiledTileLayer {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[];
  x: number;
  y: number;
  opacity: number;
  visible: boolean;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  point?: boolean;
  properties?: TiledProperty[];
}

export interface TiledObjectLayer {
  id: number;
  name: string;
  type: "objectgroup";
  draworder: "topdown" | "index";
  objects: TiledObject[];
  x: number;
  y: number;
  opacity: number;
  visible: boolean;
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  image: string;
  imagewidth: number;
  imageheight: number;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  margin: number;
  spacing: number;
  tiles?: { id: number; properties?: TiledProperty[] }[];
}

export interface TiledMap {
  type: "map";
  version: string;
  tiledversion: string;
  orientation: "orthogonal";
  renderorder: "right-down";
  infinite: false;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  nextlayerid: number;
  nextobjectid: number;
  compressionlevel: number;
  layers: (TiledTileLayer | TiledObjectLayer)[];
  tilesets: TiledTileset[];
}

export function prop<T>(props: TiledProperty[] | undefined, name: string): T | undefined {
  return props?.find((p) => p.name === name)?.value as T | undefined;
}
