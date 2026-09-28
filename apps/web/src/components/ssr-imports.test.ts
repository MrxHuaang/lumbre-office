// Phaser toca `window` apenas se carga: si un componente lo importa (aunque sea de lejos, por un
// helper), el render del servidor de Next revienta con "window is not defined". El juego se carga
// con import() dentro de un efecto; este test recorre los imports estáticos y avisa si alguno llega.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");
const EXTS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveSpec(from: string, spec: string): string | null {
  if (spec === "phaser" || spec.startsWith("phaser/")) return "phaser";
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTS) if (existsSync(base + ext)) return base + ext;
  return null;
}

/** Imports que se evalúan al cargar el módulo (los `import type` y los `import()` no cuentan). */
function staticImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const re = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm;
  const out: string[] = [];
  for (const m of src.matchAll(re)) {
    const dep = resolveSpec(file, (m[1] ?? m[2])!);
    if (dep) out.push(dep);
  }
  return out;
}

/** La cadena de imports desde `entry` hasta Phaser, o null si no llega. */
function chainToPhaser(entry: string): string[] | null {
  const prev = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    if (file === "phaser") {
      const chain: string[] = [];
      for (let at: string | null = file; at; at = prev.get(at) ?? null) chain.unshift(at === "phaser" ? at : relative(SRC, at));
      return chain;
    }
    for (const dep of staticImports(file)) if (!prev.has(dep)) (prev.set(dep, file), queue.push(dep));
  }
  return null;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("render del servidor", () => {
  it("ninguna página, componente ni helper de lib importa Phaser al cargarse", () => {
    const entries = ["app", "components", "lib"].flatMap((dir) => sources(join(SRC, dir)));
    const leaks = entries.map(chainToPhaser).filter((chain) => chain !== null).map((chain) => chain.join(" → "));
    expect(leaks).toEqual([]);
  });
});
