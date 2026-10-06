// Nada de emojis ni símbolos de la fuente en lo que se ve (textos, diálogos, cinemáticas, avisos, botones):
// cada sistema los dibuja distinto y rompen el pixel art. Los íconos van con `PixelIcon` (Cozy.tsx), los
// emotes con su arte (`art/emotes.ts`) y lo demás se dibuja por código. Los comentarios no cuentan.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const DIRS = ["apps/web/src", "apps/server/src", "packages/shared/src", "packages/map/src"];
// Emojis y pictogramas, los símbolos y dingbats (estrellas, notas, chulos, equis…), las flechas de play
// que algunos sistemas pintan como emoji y el selector de emoji.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{25B6}\u{25C0}]/u;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name.startsWith("zz-") ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** La línea sin su comentario de línea (lo de `//` en adelante, fuera de una URL). */
const code = (line: string) => {
  const t = line.trim();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return "";
  return line.replace(/(^|[^:])\/\/.*$/, "$1");
};

describe("sin emojis", () => {
  it("ningún texto del código lleva emojis ni símbolos de la fuente", () => {
    const found: string[] = [];
    for (const file of DIRS.flatMap((d) => sources(join(ROOT, d)))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const m = EMOJI.exec(code(line));
          if (m) found.push(`${relative(ROOT, file)}:${i + 1} «${m[0]}»`);
        });
    }
    expect(found).toEqual([]);
  });
});
