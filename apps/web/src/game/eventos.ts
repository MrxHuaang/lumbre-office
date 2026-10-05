// Los eventos en la escena: el pastel de la cafetería cuando alguien cumple años, el neón KARAOKE y el
// micrófono del escenario los viernes, el pesebre del recibidor en las novenas (con las figuras que lleva,
// ver novenas.ts), y lo que va sobre el nombre de cada uno (gorrito de cumpleaños,
// tomatito del foco, micrófono de quien canta). El arte está en packages/map/src/art/eventos.ts.
import type { OfficeMap } from "@hyvento/map";
import { CONFETTI_COLORS, eventOverlays, glowSprite } from "@hyvento/map/art";
import { isPlaying } from "@hyvento/shared";
import * as Phaser from "phaser";
import type { Avatar, AvatarBadge } from "./Avatar";
import { useClubStore } from "./club/store";
import { AreaView, DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "./iso/view";
import { onCongrats } from "./network";
import { useNovenas } from "./novenas";
import { useOfficeStore } from "./store";

/** Base del nivel (-1e7): el neón va justo encima de la pared y debajo de los muebles. */
const DEPTH_WALL_SIGN = -1e7 + 1;

export class EventsView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private map?: OfficeMap;
  private view?: AreaView;
  /** Qué se dibujó (nivel y eventos): se rearma solo cuando cambia. */
  private drawn = "";
  private offCongrats: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatars: () => Map<string, Avatar>,
    private readonly userOf: (sessionId: string) => string | undefined,
  ) {
    // Felicitaron a alguien: confeti sobre su avatar (lo ven los del mismo nivel).
    this.offCongrats = onCongrats((e) => {
      for (const [id, a] of this.avatars()) if (this.userOf(id) === e.toUserId) a.confetti(CONFETTI_COLORS);
    });
  }

  setArea(map: OfficeMap, view: AreaView) {
    this.map = map;
    this.view = view;
    this.drawn = "";
    this.refresh();
  }

  /** Pone o quita lo del nivel según los eventos de hoy. */
  private refresh() {
    const map = this.map;
    if (!map) return;
    const s = useOfficeStore.getState();
    const pesebre = useNovenas.getState().pesebre;
    const on = { birthday: Object.keys(s.birthdays).length > 0, karaoke: s.karaoke, pesebre: pesebre.dia > 0 ? pesebre.figuras : null };
    const key = `${map.id}:${on.birthday}:${on.karaoke}:${on.pesebre}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.clear();
    const ts = map.tileSize;
    for (const o of eventOverlays(map.id, on)) {
      const tex = ensureTexture(this.scene, o.key, () => o.sprite.canvas);
      if (!o.tile) {
        const img = this.scene.add.image(-o.sprite.ox, -o.sprite.oy, tex).setOrigin(0, 0).setDepth(DEPTH_WALL_SIGN);
        this.objects.push(img);
        // De noche el neón brilla: un resplandor sumado en el medio del letrero.
        const b = img.getBounds();
        const gkey = ensureTexture(this.scene, "evento-neon-luz", () => glowSprite(44, 18, "#ff5fd2", 0.35));
        this.objects.push(this.scene.add.image(b.centerX, b.centerY - 8, gkey).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_OVERLAY + 1));
        continue;
      }
      const anchor = worldToScreen(o.tile.x * ts, o.tile.y * ts);
      const { w, d } = o.size ?? { w: 1, d: 1 };
      // Al espejo (como un mueble mirando hacia abajo), el ancla queda del otro lado del dibujo.
      const ox = o.flip ? o.sprite.canvas.width - o.sprite.ox : o.sprite.ox;
      const img = this.scene.add
        .image(anchor.x - ox, anchor.y - o.sprite.oy, tex)
        .setOrigin(0, 0)
        .setFlipX(Boolean(o.flip))
        .setDepth(depthOf((o.tile.x + w / 2) * ts, (o.tile.y + d / 2) * ts) + 0.01);
      this.objects.push(img);
      // Con el modo privado se esconde con el mueble sobre el que está.
      const t = o.tile;
      const base = map.furniture.find((f) => t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.d);
      if (base) this.view?.attach(base, img);
    }
  }

  /** Cada cuadro: los eventos pudieron cambiar y cada uno lleva lo suyo sobre el nombre. */
  update() {
    this.refresh();
    const s = useOfficeStore.getState();
    const club = useClubStore.getState();
    // En el karaoke, canta quien puso el video que suena.
    const singer = s.karaoke && club.now && isPlaying(club) ? (club.now.byId ?? "") : "";
    for (const [id, avatar] of this.avatars()) {
      const userId = this.userOf(id);
      const info = s.players[id];
      const badges: AvatarBadge[] = [];
      if (userId && s.birthdays[userId]) badges.push("hat");
      if (info?.focus === "work") badges.push("tomato");
      if (userId && singer && userId === singer) badges.push("mic");
      avatar.setBadges(badges);
    }
  }

  private clear() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  destroy() {
    this.clear();
    this.offCongrats();
  }
}
