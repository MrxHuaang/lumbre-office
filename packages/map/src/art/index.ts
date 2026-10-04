// Arte de la cabaña (solo lo usa el navegador; el servidor importa únicamente `@hyvento/map`).
import { C, OUT, SHADOW } from "./palette";
import { PixelCanvas, alpha, at, hex } from "./pixel";

export * from "./pixel";
export * from "./palette";
export * from "./chibi";
// La piscina: la hoja de nado y lo que se anima sobre el agua.
export { drawSwimming, SWIM_DROP } from "./chibi-agua";
export { poolCover, poolFloat, poolShimmer, POOL_SHIMMER_FRAMES, waterDroplet, waterRing, type PoolFloatKind } from "./agua";
// La tina y la sauna del lago: el agua de la tina (para la hoja de medio cuerpo) y lo que se anima encima.
export { spaGlints, SPA_GLINT_FRAMES, steamPuff, TUB_RIPPLE_FRAMES, TUB_WATER, tubRipples } from "./tina";
export { drawFurniture, type Variant } from "./furniture";
export { handsetSprite, phoneBubble } from "./phone";
export { CABIN_CHIMNEY_TOP, CHIMNEY_TOPS } from "./outdoor";
export { composeArea } from "./compose";
export { CAFE_ITEM_ART, crumb, crumbColor, drawCafeItem, drawHeldItem, drawMenuItem, emberGlow, heldEffect, puff, wisp, type HeldArtState, type HeldEffect } from "./items";
export { drawEmote, EMOTE_ART } from "./emotes";
export { drawReaction, REACTION_ART, REACTION_SIZE } from "./reactions";
export { BILL_DENOMINATIONS, BILL_FRAMES, BILL_H, BILL_W, billsFor, drawBill } from "./tips";
export { emoteFrames, EMOTE_H, EMOTE_W } from "./emotes";
export { giftBox, wavingArm, GIFT_BOX_FRAMES, GIFT_BOX_H, GIFT_BOX_W } from "./social";
export { photoBoardPhotos, PHOTO_BOARD_PIC, PHOTO_BOARD_SLOTS, type PhotoThumb } from "./photos";
export { paintingSprite } from "./painting";
// El acuario de la sala (los peces que nadan son capas) y los post-its de las puertas de las oficinas.
export { ACUARIO_SWIM, aquariumBubble, miniFish, MINI_FISH_H, MINI_FISH_W } from "./acuario";
export { doorNotesArt } from "./door-notes";
export { heartSmall, lampLit, lampOff, musicNote, NOTE_COLORS, tvScreenOff, tvScreenOn, vinylSpin } from "./usables";
export { drawSurroundings, SURROUND_PAD } from "./surroundings";
// La casa del árbol: la escalera de cuerda recogida con el cartel "OCUPADO" (la cambia el cliente).
export { drawTreeLadder } from "./casa-arbol-exterior";
// El Megabús de la parada del jardín: el bus que arma el cliente, las puertas y la pantalla de la estación.
export { BUS_CAR_LEN, busCarSprite, busJointSprite, busScreenText, stationDoorsSprite, type BusCar } from "./bus";
// Sus colores (verde lima, vidrios, caucho, pasamanos, LED): también los usa la pantalla del viaje.
export * as BUS_COLORS from "./bus-colores";
// El escenario del jardín (la tela de la pantalla) y el cartel "EN EL AIRE" prendido del estudio.
export { STAGE_SCREEN } from "./escenario";
export { onAirSignSprite } from "./podcast-room";
// Clima y fauna del jardín (ver apps/web/src/game/weather.ts y critters.ts).
export { cloudShadow, fogBank, puddle, rainSplash, raindrop, RAIN_SLANT } from "./weather";
// Las estaciones (ver apps/web/src/game/seasons.ts).
export { fallingLeaf, fallingPetal, flowerTuft, leafLitter, snowflake, snowPatch } from "./estaciones";
export {
  drawBee,
  drawBird,
  drawFirefly,
  drawSquirrel,
  BEE_FRAMES,
  BIRD_FRAMES,
  BIRD_KINDS,
  SQUIRREL_FRAMES,
  type BeeFrame,
  type BirdFrame,
  type BirdKind,
  type SquirrelFrame,
} from "./fauna";
// Jardín vivo: lo que crece en las parcelas del huerto y la tierra mojada.
export { bedCropSprite, cropSprite, wetSoil, type CropStage } from "./huerto";
// La granja: los animales, la rueda del molino que gira, los huevos del nido y las nubecitas.
export { coopEggs, cornGrain, drawGoat, drawHen, FARM_POSE_FRAMES, GOAT_FRAME, HEN_FRAME, MILL_WHEEL_FRAMES, millWheel, puffBall, type FarmArtPose } from "./granja";
// Logros: las insignias del perfil y el destello al desbloquear uno.
export { BADGE_SIZE, drawBadge, drawBadgeGlyph, hasBadgeArt, sparkleSprite } from "./badges";
// Logros a la vista: la insignia chica del nombre y los trofeos de la vitrina de las oficinas.
export { drawMiniBadge, hasMiniBadge, MINI_BADGE_SIZE } from "./insignias";
export { trophyCase, trophyShelf, TROPHY_CASE_SLOTS } from "./trofeos";
// Eventos del calendario y modo foco: lo de sobre la cabeza, el pastel, el micrófono y el neón del karaoke.
export { CONFETTI_COLORS, eventOverlays, focusTomato, partyHat, singerMic, type EventOverlay } from "./eventos";
// Pesca: los peces del catálogo, la basura y las piezas del minijuego.
export { BAR as FISHING_BAR, biteMark, bobber, drawFish, drawFishingBar, fishIcon, hasFishArt, treasureChest, FISH_H, FISH_W, ROD_COLORS, ROD_COLORS_BY, type BarState } from "./fish";
// Club y arcade: los bailes del chibi y las capas que se encienden (pista, tarima, cabina, parlantes, pantallas).
export {
  drawFloorDance,
  drawPoleDance,
  DANCE_FRAMES,
  FLOOR_MOVES,
  POLE_FEET_Y,
  POLE_FRAME_H,
  POLE_FRAME_W,
  POLE_ROUTINE,
  type ArmPose,
  type DancePose,
  type PoleFrame,
} from "./chibi-baile";
export { arcadeScreen, danceFloorLights, djBoothEq, FLOOR_LIGHT_PATTERNS, poleStageLights, speakerPulse, type ArcadeScreenKind } from "./club-vivo";
export { cinemaMarquee, MARQUEE_POSTS } from "./cinema";
// El taller del garaje en uso: el carro destapado, la llanta que infla el compresor y lo de la caja de herramientas.
export { tallerBit, tallerCar, tallerTire } from "./taller";
export { CINEMA_SCREEN, drawAreaBase, drawAreaPatch, drawDoorPost, drawLowWall, drawRoomWalls, LOW_WALL_H, SCREEN_INSET, VIDEO_WALL_SCREEN, WALL_H, type AreaArt } from "./room";
// Casino: tipografía de números, geometría de las mesas, el arte del modo mesa y su encuadre. Con
// nombres explícitos (no `export *`): así un nombre genérico no choca con lo que agreguen otras partes.
export { textMask } from "./digits";
// Ajedrez y damas de la sala de juegos: el tablero del panel de la mesa, con sus piezas y marcas.
export {
  boardArt,
  cellOfSquare,
  checkersPieceArt,
  chessPieceArt,
  squareAtCell,
  squareAtPoint,
  BOARD_FRAME,
  BOARD_PX,
  BOARD_SQ,
  type BoardArtGame,
  type BoardArtOptions,
} from "./boardgames";
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
  type PieceSprite,
  type ScreenBox,
} from "./casino-mesa";
// Baccarat, dados y caballitos: las mesas de rondas compartidas (geometría y arte del modo mesa).
export { horseU, laneV, mesaCellAt, mesaCellOf, MESA_CELLS, MESA_FURNITURE, MESA_TOP_Z, type MesaCell } from "./mesas-layout";
export { baccaratCardPlan, dieFaces, dieSprite, domeOverlay, horseSprite, mesaCellMark, mesaFeltOverlay, mesaRect, DICE_SPOTS, HORSE_RAMPS, PIPS } from "./mesas";
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
// Hockey de mesa del arcade: la cancha del modo mesa, el disco, los mazos y el marcador.
export {
  hockeyBanner,
  hockeyRinkOverlay,
  hockeyRinkRect,
  malletPiece,
  puckPiece,
  rinkToScreen,
  scoreboardPiece,
  screenToRink,
  HOCKEY_BOARD,
  HOCKEY_SIDE_COLOR,
  HOCKEY_TOP_Z,
  type HockeyPiece,
} from "./hockey";

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
export { drawPet, petBowl, petMenuIcon, petTreat, sleepZ, type PetMenuIcon, PET_FRAME, PET_POSE_FRAMES, type PetArtKind, type PetArtPose, type PetView } from "./mascotas";
export { orreryArms, ORRERY_FRAMES } from "./observatorio";
// Mundo lleno: los símbolos de los rodillos del tragamonedas y el espantapájaros de cada estación.
export { SLOT_GLYPH, slotSymbol } from "./tragamonedas";
export { scarecrow } from "./leisure";
export { questMark, storyArrow, type QuestMarkKind } from "./encargos";
export { levelSpark, neighborPlate } from "./oficios";
