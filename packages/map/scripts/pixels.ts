// Guardar un Canvas (src/pixels.ts) como PNG, solo para los scripts que generan assets.
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import type { Canvas } from "../src/pixels";

export * from "../src/pixels";

export function savePng(canvas: Canvas, path: string) {
  const png = new PNG({ width: canvas.width, height: canvas.height });
  png.data = Buffer.from(canvas.data);
  writeFileSync(path, PNG.sync.write(png));
}
