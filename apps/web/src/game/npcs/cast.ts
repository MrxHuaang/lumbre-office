// Los personajes del juego que no son personas: el personal del casino (crupier, dealer, cajera y
// portero, fijos en su puesto), la astrónoma del observatorio, Don Evelio en el puesto de pesca del lago
// y el Man del Sombrero (cuando el servidor dice que anda por ahí). Se dibujan como chibis con el mismo
// Avatar de los jugadores y hablan con burbujas. Las frases y los looks están en @hyvento/shared (npcs.ts,
// pesca-tienda.ts y sombrero.ts); lo que los hace hablar llega de las mesas del casino (useCasinoStore),
// de lo que contesta la astrónoma (useObservatorio, la frase la elige el servidor), de las ventas del
// puesto de pesca y de quién está dónde.
import { pointsOfType, type OfficeMap } from "@hyvento/map";
import {
  ALL_NPCS,
  ASTRONOMA,
  astronomerGreeting,
  handValue,
  lineSeed,
  NPC,
  NPC_LINES,
  PESCA_NPC,
  pescaGreetLine,
  pescaIdleLine,
  pickLine,
  rouletteCall,
  SOMBRERO_LOOK,
  SOMBRERO_NAME,
  SOMBRERO_WHISPERS,
  type Direction,
  type GameNpc,
} from "@hyvento/shared";
import type * as Phaser from "phaser";
import { Avatar, shortName } from "../Avatar";
import { useCasinoStore, type BlackjackView, type RouletteView } from "../casino";
import { spawnWisp } from "../consumables";
import { currentGameTime } from "../gameClock";
import { worldToScreen } from "../iso/view";
import { ensureCharacterTextures } from "../looks";
import { usePescaStore } from "../pesca";
import { sfx, volAt } from "../sfx";
import { useOfficeStore } from "../store";
import { useObservatorio } from "../observatorio";
import { useSombreroStore, type SombreroView } from "./store";

/** Alguien del nivel que se está viendo (para el portero y la cajera). */
export interface CastPerson {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  zoneId: string;
}

export interface CastDeps {
  /** El jugador local (para las frases sueltas, el susurro y hacia dónde mira el Man). */
  local: () => { x: number; y: number } | null;
  /** Los que están en el nivel que se ve (yo incluido). */
  people: () => CastPerson[];
}

interface Staff {
  npc: GameNpc;
  avatar: Avatar;
  quietUntil: number;
  nextIdleAt: number;
}

/** A qué distancia (tiles) de la caja la cajera saluda (y Don Evelio, del mostrador), y el Man susurra. */
const CASHIER_TILES = 1.6;
/** Todos los que atienden en un puesto fijo: el personal del casino y el pescador del lago. */
const STAFF: readonly GameNpc[] = [...ALL_NPCS, PESCA_NPC];
/** Color de la placa del nombre de cada uno (el pescador, verde de monte). */
const TAG_COLOR: Record<string, string> = { [PESCA_NPC.id]: "#4a6b34" };
const WHISPER_TILES = 3.5;
const WHISPER_RESET_TILES = 6;
/** Cada cuánto se revisa quién entró al casino o se arrimó a la caja. */
const SCAN_MS = 250;

/** Hacia dónde mirar para ver algo que está a (dx, dy) en el mundo. */
function facingTo(dx: number, dy: number): Direction {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

export class NpcCast {
  private staff = new Map<string, Staff>();
  private man?: Avatar;
  /** Dónde está el Man que se dibujó (para saber si se fue o solo cambió de nivel quien mira). */
  private manAt = "";
  private map?: OfficeMap;
  private zoneOf = new Map<string, string>();
  private atCashier = new Set<string>();
  private atShop = new Set<string>();
  /** Quiénes ya saludó la astrónoma (hasta que se alejen). */
  private greeted = new Set<string>();
  private whispered = false;
  private scanAt = 0;
  private unsubs: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: CastDeps,
  ) {
    let roulette = useCasinoStore.getState().roulette;
    let blackjack = useCasinoStore.getState().blackjack;
    this.unsubs.push(
      useCasinoStore.subscribe((s) => {
        if (s.roulette !== roulette) {
          this.onRoulette(s.roulette, roulette);
          roulette = s.roulette;
        }
        if (s.blackjack !== blackjack) {
          this.onBlackjack(s.blackjack, blackjack);
          blackjack = s.blackjack;
        }
      }),
      useObservatorio.subscribe((s, prev) => {
        if (s.astronomer && s.astronomer !== prev.astronomer) this.onAstronomer(s.astronomer.sessionId, s.astronomer.text);
      }),
      useSombreroStore.subscribe((s, prev) => {
        if (s.man !== prev.man) this.syncMan(s.man, prev.man);
        if (s.speech && s.speech !== prev.speech) this.man?.say(s.speech.text);
      }),
      // Alguien le compró a Don Evelio: lo agradece (la frase llega igual a todos).
      usePescaStore.subscribe((s, prev) => {
        if (!s.speech || s.speech === prev.speech) return;
        this.say(PESCA_NPC.id, s.speech.text, true);
        this.staff.get(PESCA_NPC.id)?.avatar.playGesture("nod");
      }),
    );
  }

  /** Cambió el nivel que se ve: el personal del casino en el sótano, la astrónoma en el observatorio; el Man, donde tenga su escondite. */
  setArea(map: OfficeMap) {
    this.map = map;
    for (const s of this.staff.values()) s.avatar.destroy();
    this.staff.clear();
    this.zoneOf.clear();
    this.atCashier.clear();
    this.greeted.clear();
    this.atShop.clear();
    const ts = map.tileSize;
    const now = this.scene.time.now;
    for (const npc of STAFF.filter((n) => n.area === map.id)) {
      const key = ensureCharacterTextures(this.scene, "ada", npc.look);
      const x = (npc.tile.x + 0.5 + (npc.offset?.x ?? 0)) * ts;
      const y = (npc.tile.y + 0.5 + (npc.offset?.y ?? 0)) * ts;
      const avatar = new Avatar(this.scene, key, npc.name, x, y, false);
      avatar.asNpc(TAG_COLOR[npc.id] ?? (npc.role === "astronoma" ? "#34447c" : "#7a1f2b"));
      avatar.face(npc.facing);
      this.staff.set(npc.id, { npc, avatar, quietUntil: 0, nextIdleAt: now + 8000 + Math.random() * NPC.idleEveryMs });
    }
    // El Man: si está en este nivel se ve de una (sin humo: ya estaba ahí).
    this.man?.destroy();
    this.man = undefined;
    this.manAt = "";
    this.syncMan(useSombreroStore.getState().man, null);
  }

  /** ¿Estoy junto al Man del Sombrero (para la "E")? */
  sombreroNear(x: number, y: number, reachTiles: number): boolean {
    if (!this.man || !this.map) return false;
    return Math.hypot(this.man.x - x, this.man.y - y) <= reachTiles * this.map.tileSize;
  }

  /** El Man bajo el puntero (clic para ir a hablarle): dónde está parado, o null. */
  sombreroUnder(sx: number, sy: number): { x: number; y: number } | null {
    if (!this.man || !this.man.sprite.visible) return null;
    return this.man.sprite.getBounds().contains(sx, sy) ? { x: this.man.x, y: this.man.y } : null;
  }

  /** Id del personal (crupier, astrónoma…) dibujado bajo el puntero, o null (clic para ir a hablarle). */
  staffUnder(sx: number, sy: number): string | null {
    for (const [id, s] of this.staff) if (s.avatar.sprite.visible && s.avatar.sprite.getBounds().contains(sx, sy)) return id;
    return null;
  }

  update(time: number) {
    for (const a of this.avatars()) a.sway(time);
    if (time < this.scanAt) return;
    this.scanAt = time + SCAN_MS;
    const me = this.deps.local();
    if (this.staff.size) {
      this.scanPeople();
      this.idle(time, me);
    }
    if (this.man && me && this.map) this.watchLocal(me);
  }

  destroy() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    for (const s of this.staff.values()) s.avatar.destroy();
    this.staff.clear();
    this.man?.destroy();
    this.man = undefined;
  }

  /** El modo privado enfocó una sala (tiles; null = ninguna): los de adentro hablan sobre el oscurecido. */
  setOverShade(rect: { x: number; y: number; w: number; h: number } | null, ts: number) {
    for (const a of this.avatars())
      a.setOverShade(Boolean(rect) && a.x >= rect!.x * ts && a.x < (rect!.x + rect!.w) * ts && a.y >= rect!.y * ts && a.y < (rect!.y + rect!.h) * ts);
  }

  /**
   * Modo mesa: sin nombres, como los jugadores (con tanto zoom el nombre, que crece con la cámara, tapa la
   * mesa). Los globos siguen: el crupier canta el número.
   */
  setNameHidden(hidden: boolean) {
    for (const a of this.avatars()) a.setNameHidden(hidden);
  }

  /** Los cuerpos del personal y del Man, para atenuar al que tape la mesa en el modo mesa. */
  sprites(): Phaser.GameObjects.Sprite[] {
    return [...this.avatars()].map((a) => a.sprite);
  }

  private *avatars(): Iterable<Avatar> {
    for (const s of this.staff.values()) yield s.avatar;
    if (this.man) yield this.man;
  }

  // ---------- El personal del casino ----------

  /** Que diga algo (si no habló hace poco; `force` = cantar el número, que no espera). */
  private say(id: string, text: string, force = false) {
    const s = this.staff.get(id);
    if (!s) return;
    const now = this.scene.time.now;
    if (!force && now < s.quietUntil) return;
    s.quietUntil = now + NPC.quietMs;
    s.nextIdleAt = Math.max(s.nextIdleAt, now + NPC.idleEveryMs / 2);
    s.avatar.say(text);
  }

  /** ¿Hay alguien a menos de `tiles` de ese personaje? (la ruleta gira sola aunque no juegue nadie). */
  private audience(id: string, tiles: number): boolean {
    const s = this.staff.get(id);
    const ts = this.map?.tileSize ?? 32;
    return Boolean(s) && this.deps.people().some((p) => Math.hypot(p.x - s!.avatar.x, p.y - s!.avatar.y) <= tiles * ts);
  }

  private onRoulette(r: RouletteView, prev: RouletteView) {
    if (r.phase === prev.phase || !this.staff.has("crupier")) return;
    // Sin apuestas ni nadie cerca, el crupier no le habla a la mesa vacía.
    if (r.bets.length === 0 && !this.audience("crupier", 6)) return;
    if (r.phase === "betting") this.say("crupier", pickLine(NPC_LINES.rouletteOpen, r.round));
    else if (r.phase === "spinning" && r.bets.length > 0) this.say("crupier", pickLine(NPC_LINES.rouletteClose, r.round));
    else if (r.phase === "result" && r.result >= 0) {
      // Canta el número siempre (es lo que todos esperan) y, a veces, algo más.
      const extra = r.bets.length > 0 && r.round % 3 === 0 ? ` ${pickLine(NPC_LINES.rouletteAfter, r.round)}` : "";
      this.say("crupier", `${rouletteCall(r.result)}${extra}`, true);
      this.staff.get("crupier")?.avatar.playGesture("nod");
    }
  }

  private onBlackjack(b: BlackjackView, prev: BlackjackView) {
    if (b.phase === prev.phase) return;
    const seated = b.seats.filter((s) => s.userId);
    if (b.phase === "betting") this.say("dealer", pickLine(NPC_LINES.blackjackOpen, b.round));
    else if (b.phase === "playing") {
      // Reparte: el gesto de pasar las cartas.
      this.staff.get("dealer")?.avatar.playGesture("wave");
      this.say("dealer", pickLine(NPC_LINES.blackjackDeal, b.round));
    } else if (b.phase === "result" && seated.length > 0) {
      const outcomes = seated.map((s) => s.outcome);
      const cards = b.dealer.filter((c) => c >= 0);
      const lines = outcomes.includes("blackjack")
        ? NPC_LINES.playerBlackjack
        : cards.length > 0 && handValue(cards).total > 21
          ? NPC_LINES.dealerBust
          : outcomes.includes("win")
            ? NPC_LINES.bankLoses
            : outcomes.every((o) => o === "lose")
              ? NPC_LINES.bankWins
              : null;
      if (lines) this.say("dealer", pickLine(lines, b.round), true);
      this.staff.get("dealer")?.avatar.playGesture(lines === NPC_LINES.bankWins ? "nod" : "sway");
    }
  }

  /** El portero saluda a quien entra al casino (y despide a quien sale); la cajera, a quien se arrima. */
  private scanPeople() {
    const map = this.map;
    if (!map) return;
    const cashier = pointsOfType(map, "casino_cashier");
    const shop = this.staff.has(PESCA_NPC.id) ? pointsOfType(map, "fishing_shop") : [];
    const reach = CASHIER_TILES * map.tileSize;
    const seen = new Set<string>();
    for (const p of this.deps.people()) {
      seen.add(p.sessionId);
      const before = this.zoneOf.get(p.sessionId);
      this.zoneOf.set(p.sessionId, p.zoneId);
      const name = shortName(p.name).split(" ")[0] ?? p.name;
      // Todos ven la misma frase: sale de quién es y de cuántas veces se ha ido y vuelto.
      const seed = lineSeed(`${p.sessionId}:${Math.floor(Date.now() / 60_000)}`);
      if (before === "vestibulo" && p.zoneId === "casino") {
        this.say("portero", pickLine(NPC_LINES.doorIn, seed).replace("{name}", name));
        this.staff.get("portero")?.avatar.playGesture("nod");
      } else if (before === "casino" && p.zoneId === "vestibulo" && seed % 2 === 0) {
        this.say("portero", pickLine(NPC_LINES.doorOut, seed).replace("{name}", name));
      }
      const near = cashier.some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= reach);
      if (near && !this.atCashier.has(p.sessionId)) {
        this.atCashier.add(p.sessionId);
        this.say("cajera", pickLine(NPC_LINES.cashier, seed));
      } else if (!near) this.atCashier.delete(p.sessionId);
      // Don Evelio saluda al que se arrima al mostrador, con un comentario de la hora o del clima.
      const atShop = shop.some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= reach);
      if (atShop && !this.atShop.has(p.sessionId)) {
        this.atShop.add(p.sessionId);
        this.say(PESCA_NPC.id, pescaGreetLine(name, currentGameTime()?.hour ?? 12, useOfficeStore.getState().weather, seed));
        this.staff.get(PESCA_NPC.id)?.avatar.playGesture("wave");
      } else if (!atShop) this.atShop.delete(p.sessionId);
      this.greetAstronomer(p, name);
    }
    for (const id of [...this.atShop]) if (!seen.has(id)) this.atShop.delete(id);
    for (const id of [...this.zoneOf.keys()]) if (!seen.has(id)) this.zoneOf.delete(id);
    for (const id of [...this.greeted]) if (!seen.has(id)) this.greeted.delete(id);
  }

  /**
   * La astrónoma saluda a quien se le arrima (una vez, hasta que se aleje) y lo mira. Todos ven el mismo
   * saludo: sale de quién es y de la hora del juego.
   */
  private greetAstronomer(p: CastPerson, name: string) {
    const s = this.staff.get("astronoma");
    const ts = this.map?.tileSize ?? 32;
    if (!s) return;
    const d = Math.hypot(p.x - s.avatar.x, p.y - s.avatar.y);
    if (d > ASTRONOMA.greetResetTiles * ts) this.greeted.delete(p.sessionId);
    if (d > ASTRONOMA.greetTiles * ts || this.greeted.has(p.sessionId)) return;
    this.greeted.add(p.sessionId);
    const t = currentGameTime();
    s.avatar.face(facingTo(p.x - s.avatar.x, p.y - s.avatar.y));
    this.say("astronoma", astronomerGreeting(name, lineSeed(`${p.sessionId}:${t?.day ?? 0}:${t?.hour ?? 0}`)));
    s.avatar.playGesture("wave");
  }

  /** Lo que contestó la astrónoma (llega del servidor, igual para todos): lo dice mirando a quien preguntó. */
  private onAstronomer(sessionId: string, text: string) {
    const s = this.staff.get("astronoma");
    if (!s) return;
    const who = this.deps.people().find((p) => p.sessionId === sessionId);
    if (who) s.avatar.face(facingTo(who.x - s.avatar.x, who.y - s.avatar.y));
    this.say("astronoma", text, true);
    s.avatar.playGesture("nod");
  }

  /** De vez en cuando, si estoy cerca, alguno dice algo suelto. */
  private idle(time: number, me: { x: number; y: number } | null) {
    if (!me || !this.map) return;
    const near = NPC.idleNearTiles * this.map.tileSize;
    for (const s of this.staff.values()) {
      if (time < s.nextIdleAt) continue;
      s.nextIdleAt = time + NPC.idleEveryMs * (0.7 + Math.random() * 0.8);
      if (Math.hypot(s.avatar.x - me.x, s.avatar.y - me.y) > near) continue;
      if (s.npc.id === PESCA_NPC.id) {
        // El pescador comenta la hora del juego y el clima (la misma frase para todos en ese rato).
        const slot = Math.floor(Date.now() / NPC.idleEveryMs);
        this.say(s.npc.id, pescaIdleLine(currentGameTime()?.hour ?? 12, useOfficeStore.getState().weather, lineSeed(`evelio:${slot}`)));
        continue;
      }
      this.say(s.npc.id, s.npc.idle[Math.floor(Math.random() * s.npc.idle.length)]!);
    }
  }

  // ---------- El Man del Sombrero ----------

  /**
   * Aparece, se va o se muda. Con humito cuando pasa delante de uno (`prev` != null: cambió el estado);
   * al entrar uno al nivel (`prev` = null) ya estaba ahí y se ve de una.
   */
  private syncMan(man: SombreroView, prev: SombreroView | null) {
    const map = this.map;
    if (!map) return;
    const here = man.present && man.area === map.id;
    const key = `${man.area}:${man.x},${man.y}`;
    if (here && this.man && this.manAt === key) return;
    const live = prev !== null;
    if (this.man) {
      if (live) this.poof(this.man.x, this.man.y);
      this.man.destroy();
      this.man = undefined;
      this.manAt = "";
    }
    if (!here) return;
    const ts = map.tileSize;
    const avatar = new Avatar(this.scene, ensureCharacterTextures(this.scene, "ada", SOMBRERO_LOOK), SOMBRERO_NAME, (man.x + 0.5) * ts, (man.y + 0.5) * ts, false);
    avatar.asNpc("#3a3a40");
    avatar.face((["down", "left", "right", "up"] as const).find((d) => d === man.facing) ?? "down");
    this.man = avatar;
    this.manAt = key;
    this.whispered = false;
    if (live) this.poof(avatar.x, avatar.y);
  }

  /** Nube de humo gris alrededor de los pies (y el ¡puf!). */
  private poof(x: number, y: number) {
    const s = worldToScreen(x, y);
    const depth = x + y;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      spawnWisp(this.scene, s.x + Math.cos(a) * 6, s.y - 8 + Math.sin(a) * 4, depth, {
        fx: "smoke",
        from: 1,
        to: 3,
        rise: 10 + Math.random() * 14,
        drift: Math.cos(a) * 8,
        wobble: 2,
        ms: 1200 + Math.random() * 600,
        delay: k * 20,
      });
    }
    sfx.poof(volAt(x, y));
  }

  /** Cuando me acerco, me mira y me susurra (una vez por acercada). */
  private watchLocal(me: { x: number; y: number }) {
    const man = this.man!;
    const ts = this.map!.tileSize;
    const d = Math.hypot(man.x - me.x, man.y - me.y);
    if (d <= WHISPER_TILES * ts) {
      man.face(facingTo(me.x - man.x, me.y - man.y));
      if (!this.whispered) {
        this.whispered = true;
        man.say(SOMBRERO_WHISPERS[Math.floor(Math.random() * SOMBRERO_WHISPERS.length)]!);
      }
    } else if (d > WHISPER_RESET_TILES * ts) this.whispered = false;
  }
}
