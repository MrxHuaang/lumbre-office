// Recorte por cámara: Phaser (con el renderer Canvas) dibuja todo lo que está en la lista, se vea o no.
// En el jardín son ~1.500 imágenes (árboles, matas, faroles, hojas) y la cámara ve ~130: cada cuadro
// se iban ~1.300 drawImage a la basura. Aquí se filtra por el rectángulo que ve la cámara.
import * as Phaser from "phaser";

/**
 * Margen (px de mundo) alrededor de lo que ve la cámara: cubre el redondeo de los bordes y lo que se
 * corre en un cuadro (el seguimiento suave, el zoom). De más no molesta: solo se dibuja un poco más.
 */
const MARGIN = 48;

type Boxed = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

/**
 * ¿La imagen cae (con el margen) en la vista? Solo imágenes y sprites sueltos (sin contenedor), que es
 * casi todo lo que hay; lo demás (contenedores de los avatares, textos, gráficos, la baldosa del bosque)
 * se dibuja siempre, como antes.
 */
function inView(o: Phaser.GameObjects.GameObject, x0: number, y0: number, x1: number, y1: number): boolean {
  if (o.type !== "Image" && o.type !== "Sprite") return true;
  const s = o as Boxed;
  // Lo pegado a la pantalla (scrollFactor distinto de 1) no se mueve con el mundo.
  if (s.scrollFactorX !== 1 || s.scrollFactorY !== 1) return true;
  const sx = Math.abs(s.scaleX);
  const sy = Math.abs(s.scaleY);
  const w = s.width * sx;
  const h = s.height * sy;
  let left: number, top: number, right: number, bottom: number;
  if (s.rotation !== 0 || s.scaleX < 0 || s.scaleY < 0) {
    // Girado o espejado por escala: un cuadrado que lo contiene seguro (son pocos).
    const r = Math.hypot(w, h);
    left = s.x - r;
    right = s.x + r;
    top = s.y - r;
    bottom = s.y + r;
  } else {
    // El volteo (flipX/flipY) dibuja dentro de la misma caja: no cambia los bordes.
    left = s.x - s.displayOriginX * sx;
    top = s.y - s.displayOriginY * sy;
    right = left + w;
    bottom = top + h;
  }
  return right >= x0 && left <= x1 && bottom >= y0 && top <= y1;
}

/**
 * Instala el recorte en la escena: reemplaza el filtro de la lista de dibujo de sus cámaras (el que ya
 * saca lo invisible) por uno que además saca lo que queda fuera de la vista. No toca `visible` ni
 * `cameraFilter`, así no choca con quien esconde cosas a propósito. Devuelve cómo quitarlo.
 */
export function installCameraCulling(scene: Phaser.Scene): () => void {
  const cams = scene.cameras;
  const original = cams.getVisibleChildren;
  cams.getVisibleChildren = function (children: Phaser.GameObjects.GameObject[], camera: Phaser.Cameras.Scene2D.Camera) {
    // worldView ya está al día: la cámara se prepara (preRender) justo antes de pedir la lista.
    const v = camera.worldView;
    const x0 = v.x - MARGIN;
    const y0 = v.y - MARGIN;
    const x1 = v.right + MARGIN;
    const y1 = v.bottom + MARGIN;
    const out: Phaser.GameObjects.GameObject[] = [];
    for (const c of children) if (c.willRender(camera) && inView(c, x0, y0, x1, y1)) out.push(c);
    return out;
  };
  return () => {
    cams.getVisibleChildren = original;
  };
}
