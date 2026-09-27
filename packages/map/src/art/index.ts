// Arte de la cabaña (solo lo usa el navegador; el servidor importa únicamente `@hyvento/map`).
import { C, OUT, SHADOW } from "./palette";
import { PixelCanvas, alpha, at, hex } from "./pixel";

export * from "./pixel";
export * from "./palette";
export * from "./chibi";
export { drawFurniture, type Variant } from "./furniture";
export { CABIN_CHIMNEY_TOP, CHIMNEY_TOPS } from "./outdoor";
export { composeArea } from "./compose";
export { CAFE_ITEM_ART, crumb, crumbColor, drawCafeItem, drawHeldItem, drawMenuItem, emberGlow, heldEffect, puff, wisp, type HeldArtState, type HeldEffect } from "./items";
export { drawEmote, EMOTE_ART } from "./emotes";
export { emoteFrames, EMOTE_H, EMOTE_W } from "./emotes";
export { giftBox, wavingArm, GIFT_BOX_FRAMES, GIFT_BOX_H, GIFT_BOX_W } from "./social";
export { heartSmall, lampLit, lampOff, musicNote, NOTE_COLORS, tvScreenOff, tvScreenOn, vinylSpin } from "./usables";
export { drawSurroundings, SURROUND_PAD } from "./surroundings";
// Pesca: los peces del catálogo, la basura y las piezas del minijuego.
export { BAR as FISHING_BAR, biteMark, bobber, drawFish, drawFishingBar, fishIcon, hasFishArt, treasureChest, FISH_H, FISH_W, ROD_COLORS, type BarState } from "./fish";
export { drawAreaBase, drawDoorPost, drawLowWall, LOW_WALL_H, WALL_H, type AreaArt } from "./room";
// Casino: tipografía de números, geometría de las mesas, el arte del modo mesa y su encuadre. Con
// nombres explícitos (no `export *`): así un nombre genérico no choca con lo que agreguen otras partes.
export { textMask } from "./digits";
export {
  betKey,
  rouletteCellAt,
  rouletteCellOf,
  BLACKJACK_DISCARD,
  BLACKJACK_SHOE,
  BLACKJACK_SPOTS,
  BLACKJACK_TOP_Z,
  ROULETTE_TOP_Z,
  type RouletteCell,
} from "./casino-layout";
export {
  betChips,
  blackjackDealerPlan,
  blackjackFeltOverlay,
  blackjackHandPlan,
  blackjackSpotMark,
  cardSprite,
  chipStack,
  discardSprite,
  localToScreen,
  mesaFrame,
  restPose,
  rouletteCellMark,
  rouletteFeltOverlay,
  screenToLocal,
  shoeSprite,
  spinPose,
  tagSprite,
  CHIP_VALUES,
  WheelPainter,
  type BallPose,
  type MesaFrame,
  type Overlay,
  type ScreenBox,
} from "./casino-mesa";
export {
  blackjackFeltRect,
  rouletteFeltRect,
  tableZoom,
  wheelBowlRect,
  wheelZoom,
  TABLE_MAX_ZOOM,
  TABLE_MIN_ZOOM,
  type TableViewport,
} from "./casino-camara";

/** Halo de luz en bandas tramadas (se suma de noche). */
export function glowSprite(rx: number, ry: number, color: string, maxAlpha: number): PixelCanvas {
  const c = new PixelCanvas(rx * 2 + 2, ry * 2 + 2);
  c.glow(rx + 1, ry + 1, rx, ry, hex(color), maxAlpha, 4);
  return c;
}

/** Contorno de un tile (rombo de 32x16) para marcar a dónde se camina. */
export function tileCursor(color = at(C.cream, 5)): PixelCanvas {
  const c = new PixelCanvas(33, 17);
  const col = alpha(color, 0.95);
  c.line(0, 8, 15, 1, col);
  c.line(16, 0, 16, 0, col);
  c.line(17, 1, 32, 8, col);
  c.line(32, 8, 17, 15, col);
  c.line(16, 16, 16, 16, col);
  c.line(15, 15, 0, 8, col);
  return c;
}

export function characterShadow(): PixelCanvas {
  const c = new PixelCanvas(14, 6);
  c.ellipse(7, 3, 6, 2.6, alpha(SHADOW, 0.35));
  return c;
}

/** Globo de diálogo pixel de w x h (el texto lo pone Phaser encima), con la colita abajo al centro. */
export function bubble(w: number, h: number): PixelCanvas {
  const c = new PixelCanvas(w + 2, h + 5);
  c.rect(2, 1, w - 2, h, at(C.cream, 4));
  c.rect(1, 2, w, h - 2, at(C.cream, 4));
  c.rect(2, h - 1, w - 2, 1, at(C.cream, 2));
  const tx = Math.floor(w / 2);
  c.rect(tx - 1, h + 1, 3, 1, at(C.cream, 4));
  c.set(tx, h + 2, at(C.cream, 4));
  c.outline(OUT);
  return c;
}

/** Placa de nombre (fondo crema con borde de madera) de w x h. */
export function plate(w: number, h: number, fill = at(C.cream, 4)): PixelCanvas {
  const c = new PixelCanvas(w + 2, h + 2);
  c.rect(1, 1, w, h, at(C.wood, 3));
  c.rect(2, 2, w - 2, h - 2, fill);
  c.outline(OUT);
  return c;
}

// Casa viva: llamas, cortinas, lo que avanza para todos, el baño, lo que se lleva un rato en la mano y
// las mascotas (con nombres explícitos, como el casino).
export {
  curtainClosed,
  flame,
  globeSpin,
  openBook,
  progressLayer,
  roastStick,
  soapBubble,
  spark,
  stallLight,
  waterDrop,
  wateringCan,
  FLAME_FRAMES,
  type FlameSize,
} from "./casa-fx";
export { drawPet, petTreat, sleepZ, PET_FRAME, PET_POSE_FRAMES, type PetArtKind, type PetArtPose, type PetView } from "./mascotas";
