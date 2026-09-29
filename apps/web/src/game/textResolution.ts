// Los textos del canvas (nombres, placas, burbujas) se rasterizan a la escala a la que se ven: cada píxel
// del texto cae en un píxel de pantalla. Con una resolución fija más alta, la cámara los achicaba saltando
// filas de píxeles (se veían borrosos o comidos). Antes se recorría la escena entera cada 300 ms buscando
// textos nuevos; ahora cada texto se anota al entrar a la escena y solo se recorren al cambiar el zoom.
import * as Phaser from "phaser";

type GameObject = Phaser.GameObjects.GameObject;

function apply(t: Phaser.GameObjects.Text, r: number) {
  // Phaser solo copia la resolución a la textura al crear el texto: sin esto se dibuja achicado.
  if (t.style.resolution === r) return;
  t.frame.source.resolution = r;
  t.setResolution(r);
}

export class TextResolution {
  private texts = new Set<Phaser.GameObjects.Text>();
  private res = 0;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // `scene.add.text` pasa por la lista de dibujo: el evento llega aunque después se meta en un contenedor.
    scene.sys.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.track, this);
    // Los que ya estaban (incluso dentro de contenedores).
    const visit = (list: GameObject[]) => {
      for (const o of list) {
        this.track(o);
        if (o instanceof Phaser.GameObjects.Container) visit(o.list);
      }
    };
    visit(scene.children.list);
  }

  private track(o: GameObject) {
    if (!(o instanceof Phaser.GameObjects.Text) || this.texts.has(o)) return;
    this.texts.add(o);
    o.once(Phaser.GameObjects.Events.DESTROY, () => this.texts.delete(o));
    if (this.res) apply(o, this.res);
  }

  /** Cada cuadro: si el zoom entero cambió, se redibujan todos a la escala nueva. */
  sync(zoom: number) {
    const r = Math.max(1, Math.round(zoom));
    if (r === this.res) return;
    this.res = r;
    for (const t of this.texts) apply(t, r);
  }

  dispose() {
    this.scene.sys.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.track, this);
    this.texts.clear();
  }
}
