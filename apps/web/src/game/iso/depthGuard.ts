// Phaser reordena toda la lista de dibujo (~1.700 objetos en el jardín) cada vez que alguien le pone
// profundidad a un objeto, aunque sea la misma que ya tenía. Varios módulos la ponen en cada cuadro (el
// personaje propio, las gallinas, las mascotas) y así el orden se rehacía siempre, con todo quieto. Aquí
// se ignora el cambio cuando el valor es igual: el orden solo depende de la profundidad, así que no cambia
// nada de lo que se ve.
import * as Phaser from "phaser";

let installed = false;

export function guardDepthSort() {
  if (installed) return;
  installed = true;
  // La profundidad viene de un mixin copiado en el prototipo de cada clase: se envuelve en cada una.
  for (const cls of Object.values(Phaser.GameObjects)) {
    const proto = typeof cls === "function" ? (cls as { prototype?: object }).prototype : undefined;
    if (!proto) continue;
    const d = Object.getOwnPropertyDescriptor(proto, "depth");
    if (!d?.set || !d.get) continue;
    const set = d.set;
    try {
      Object.defineProperty(proto, "depth", {
        ...d,
        set(this: { _depth: number }, value: number) {
          if (this._depth === value) return;
          set.call(this, value);
        },
      });
    } catch {
      // Si alguna no se deja redefinir, sigue como siempre (solo se pierde el ahorro).
    }
  }
}
