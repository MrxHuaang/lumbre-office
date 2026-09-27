// Algo del DOM (el iframe de YouTube, el video de una pantalla compartida) montado encima del canvas sobre
// una pantalla colgada en la pared: se estira con una matriz CSS para que caiga sobre la pared inclinada,
// con bandas negras si no calza en 16:9. El elemento no se mueve nunca de lugar en el DOM (un iframe que
// se mueve se recarga): solo cambia el estilo del recuadro que lo contiene.
import { L, WORLD_TO_ART } from "@hyvento/map/art";
import type { OfficeMap, WallFeature } from "@hyvento/map";
import type * as Phaser from "phaser";
import { worldToScreen } from "./iso/view";

export interface Point {
  x: number;
  y: number;
}

/** Dónde cae la imagen de la pantalla, en px del contenedor del juego (tres esquinas del recuadro). */
export interface ScreenQuad {
  tl: Point;
  tr: Point;
  bl: Point;
  /** Proporción ancho/alto del recuadro en la pared (sin la inclinación). */
  aspect: number;
}

/** El recuadro de la imagen dentro del dibujo de una pantalla colgada (unidades de arte, ver room.ts). */
export interface ScreenInset {
  u0: number;
  uPad: number;
  hv0: number;
  hv1: number;
}

/** Punto de la escena (coordenadas de mundo de Phaser) → px del contenedor del juego. */
export function sceneToCss(scene: Phaser.Scene, p: Point): Point {
  const cam = scene.cameras.main;
  const canvas = scene.game.canvas;
  const k = canvas.clientWidth / scene.scale.width || 1;
  return { x: (p.x - cam.worldView.x) * cam.zoom * k + canvas.offsetLeft, y: (p.y - cam.worldView.y) * cam.zoom * k + canvas.offsetTop };
}

/**
 * Dónde se ve la imagen de una pantalla colgada en la pared (null si está fuera de la vista). En una pared
 * norte (`h`) la `u` del dibujo corre hacia +x; en una oeste (`v`) corre desde la punta sur hacia el
 * norte (así la pinta room.ts), que en pantalla también es de izquierda a derecha.
 */
export function wallQuad(scene: Phaser.Scene, map: OfficeMap, f: WallFeature, inset: ScreenInset, parent: HTMLElement): ScreenQuad | null {
  const len = (f.width ?? 1) * L;
  const u1 = len - inset.uPad;
  const x0 = f.x * map.tileSize;
  const y0 = f.y * map.tileSize;
  const at =
    f.edge === "h"
      ? (u: number, hv: number) => sceneToCss(scene, worldToScreen(x0 + u / WORLD_TO_ART, y0, hv))
      : (u: number, hv: number) => sceneToCss(scene, worldToScreen(x0, y0 + (len - u) / WORLD_TO_ART, hv));
  const q = { tl: at(inset.u0, inset.hv1), tr: at(u1, inset.hv1), bl: at(inset.u0, inset.hv0), aspect: (u1 - inset.u0) / (inset.hv1 - inset.hv0) };
  const xs = [q.tl.x, q.tr.x, q.bl.x];
  const ys = [q.tl.y, q.tr.y, q.bl.y];
  const off = Math.max(...xs) < 0 || Math.min(...xs) > parent.clientWidth || Math.max(...ys) < -40 || Math.min(...ys) > parent.clientHeight;
  return off ? null : q;
}

/** Ancho base del recuadro (px antes de la matriz): de ahí salen el tamaño del contenido y su calidad. */
const BASE_W = 640;

export interface MountOptions {
  onClick?: () => void;
  /** Títulos de la pantalla chica (en la pared) y de la grande. */
  titles?: { small: string; big: string };
  /** Borde de la vista en grande. */
  bigFrame?: string;
}

export class WallMount {
  private host: HTMLDivElement;
  /** Lo que se monta (iframe o video) va aquí, centrado en 16:9. */
  readonly frame: HTMLDivElement;
  private layout = "";

  constructor(
    parent: HTMLElement,
    private readonly opts: MountOptions = {},
  ) {
    this.host = document.createElement("div");
    Object.assign(this.host.style, {
      position: "absolute",
      left: "0",
      top: "0",
      transformOrigin: "0 0",
      background: "#05030a",
      overflow: "hidden",
      visibility: "hidden",
      cursor: opts.onClick ? "zoom-in" : "default",
      zIndex: "1",
    } satisfies Partial<CSSStyleDeclaration>);
    this.host.addEventListener("click", () => opts.onClick?.());
    this.frame = document.createElement("div");
    // El contenido no recibe clics: los toma el recuadro (para agrandar), no los controles de YouTube.
    Object.assign(this.frame.style, { position: "absolute", pointerEvents: "none" } satisfies Partial<CSSStyleDeclaration>);
    this.host.appendChild(this.frame);
    parent.appendChild(this.host);
  }

  get parent() {
    return this.host.parentElement;
  }

  /** Sobre la pared (`quad`), en grande (`big`) o escondido (ninguno de los dos). */
  place(quad: ScreenQuad | null, big: boolean) {
    const parent = this.host.parentElement;
    let layout = "hidden";
    if (parent && big) {
      const w = Math.min(parent.clientWidth * 0.8, (parent.clientHeight * 0.75 * 16) / 9);
      const h = (w * 9) / 16;
      layout = `big:${Math.round(w)}x${Math.round(h)}:${Math.round((parent.clientWidth - w) / 2)},${Math.round((parent.clientHeight - h) / 2)}`;
    } else if (parent && quad) {
      const bh = BASE_W / quad.aspect;
      const a = (quad.tr.x - quad.tl.x) / BASE_W;
      const b = (quad.tr.y - quad.tl.y) / BASE_W;
      const c = (quad.bl.x - quad.tl.x) / bh;
      const d = (quad.bl.y - quad.tl.y) / bh;
      layout = `wall:${bh.toFixed(1)}:${[a, b, c, d, quad.tl.x, quad.tl.y].map((n) => n.toFixed(3)).join(",")}`;
    }
    if (layout === this.layout) return;
    this.layout = layout;
    const st = this.host.style;
    if (layout === "hidden") {
      st.visibility = "hidden";
      return;
    }
    st.visibility = "visible";
    let w: number;
    let h: number;
    if (layout.startsWith("big:")) {
      const [size, pos] = layout.slice(4).split(":");
      [w, h] = size!.split("x").map(Number) as [number, number];
      const [x, y] = pos!.split(",").map(Number) as [number, number];
      st.transform = `translate(${x}px, ${y}px)`;
      st.zIndex = "30";
      st.cursor = this.opts.onClick ? "zoom-out" : "default";
      st.boxShadow = this.opts.bigFrame ?? "0 0 0 4px #1d1128, 0 0 0 7px #ff5fd2, 8px 8px 0 7px #1d1128";
      this.host.title = this.opts.titles?.big ?? "";
    } else {
      const [bh, m] = layout.slice(5).split(":");
      w = BASE_W;
      h = Number(bh);
      st.transform = `matrix(${m})`;
      st.zIndex = "1";
      st.cursor = this.opts.onClick ? "zoom-in" : "default";
      st.boxShadow = "none";
      this.host.title = this.opts.titles?.small ?? "";
    }
    st.width = `${w}px`;
    st.height = `${h}px`;
    const fw = Math.min(w, (h * 16) / 9);
    const fh = (fw * 9) / 16;
    Object.assign(this.frame.style, { width: `${fw}px`, height: `${fh}px`, left: `${(w - fw) / 2}px`, top: `${(h - fh) / 2}px` });
  }

  destroy() {
    this.host.remove();
  }
}
