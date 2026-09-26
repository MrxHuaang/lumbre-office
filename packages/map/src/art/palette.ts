// Paleta cozy (estilo Stardew): rampas de oscuro a claro, con sombras que tiran a morado y luces a
// amarillo. Nunca negro puro: el contorno es café oscuro.
import { hex, ramp, type RGBA } from "./pixel";

export const OUT = hex("#2b1b17");
export const SHADOW = hex("#2b1b2f");

export const C = {
  wood: ramp("#4a2a1c", "#6e3b22", "#95552c", "#b8733a", "#d6934e", "#ecb872"),
  woodDark: ramp("#26160f", "#3f2416", "#5a331d", "#764527", "#925a33", "#ad7446"),
  sage: ramp("#2e3f33", "#44604a", "#5f8360", "#7fa375", "#a7c48f", "#cfe0ad"),
  cream: ramp("#7d6450", "#a8896a", "#cdb08a", "#e6d0a6", "#f7ebc8", "#fffaf0"),
  blue: ramp("#26334f", "#34507a", "#4a70a0", "#6f93bf", "#9cb9da", "#cfe0f0"),
  rose: ramp("#4f2a3a", "#7a3f52", "#a45a6c", "#c47d8a", "#dea7ad", "#f2d3d2"),
  leaf: ramp("#1b3526", "#29553a", "#3c7a3f", "#5ea247", "#8cc653", "#c0e377"),
  grass: ramp("#23452c", "#2f6036", "#43803f", "#5d9c46", "#7fb853", "#a8d46a"),
  dirt: ramp("#3b2418", "#5a3822", "#7a5030", "#9a6a40", "#b98752"),
  stone: ramp("#3c3a44", "#57545f", "#76727c", "#9a95a0", "#bdb8c0", "#e0dce0"),
  terracotta: ramp("#4f2419", "#7a3a25", "#a65132", "#c96f45", "#e39462"),
  fabric: ramp("#1f2747", "#2f3f73", "#4660a0", "#6886c4", "#98b4e0", "#c8dbf3"),
  green: ramp("#1f3a2c", "#2e5a40", "#437a55", "#5f9a6d", "#8abd92", "#bfe0c0"),
  rug: ramp("#431b26", "#6d2733", "#983a3c", "#c05a4a", "#dd8a62", "#f1b98a"),
  metal: ramp("#1d2130", "#30374b", "#4b5470", "#6e7a98", "#a0acc6", "#d3dbea"),
  screen: ramp("#0f2238", "#173d5c", "#1f6485", "#2f93a8", "#5fc4bf", "#b0eed8"),
  gold: ramp("#5c3d10", "#8a5c17", "#b98424", "#dcae3f", "#f3d672", "#fff0b0"),
  sky: ramp("#3d6fb0", "#5d93cf", "#86b8e6", "#b5d9f5", "#e3f3ff"),
  night: ramp("#0c1024", "#151c3d", "#212c5a", "#34457f"),
  curtain: ramp("#5a1f24", "#822f30", "#a8463d", "#c9674e", "#e08f68"),
  cork: ramp("#6b4424", "#8f5f33", "#b3804a", "#cf9e64", "#e2bb85"),
  mustard: ramp("#6b4a12", "#a0741f", "#cfa033", "#e9c65a", "#f6de8c"),
  logs: ramp("#3a2014", "#5c3420", "#80492a", "#a36336", "#c4834a", "#dfa66a"),
  roof: ramp("#3a1a1c", "#5e2a28", "#8a3a30", "#b0503a", "#cf7550", "#e89c70"),
  fire: ramp("#7a1f0e", "#c2401a", "#ee7a22", "#fbb23c", "#fde38a"),
  white: ramp("#8a8a96", "#b4b4be", "#d8d8de", "#f0f0f2", "#ffffff"),
  // Sótano: el cine (azul noche) y el club (violeta y neón).
  navy: ramp("#101530", "#1a2248", "#263262", "#34447c", "#4a5c98", "#7084b8"),
  violet: ramp("#1e1030", "#34194f", "#4f2672", "#6e3a96", "#9459ba", "#c08ae0"),
  neon: ramp("#5a0f4a", "#9c1a78", "#e0359f", "#ff5fd2", "#ff9ae6", "#ffe0f6"),
  cyan: ramp("#0c3a4a", "#12627a", "#1a95ad", "#3fd0dd", "#8ef0f0", "#dafffb"),
};

export const BOOKS: RGBA[] = [
  C.rug[2]!,
  C.sage[2]!,
  C.mustard[2]!,
  C.fabric[2]!,
  hex("#7a4a7e"),
  C.screen[3]!,
  C.cream[3]!,
  C.curtain[3]!,
];

export const mix = (a: RGBA, b: RGBA, t: number): RGBA => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
  255,
];

export const inRect = (u: number, v: number, u0: number, v0: number, u1: number, v1: number) =>
  u >= u0 && u < u1 && v >= v0 && v < v1;
