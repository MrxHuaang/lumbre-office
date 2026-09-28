"use client";

// Fase 3c: el panel del modo decorar (a la derecha, mientras decoras tu oficina). Los muebles de la
// mochila para poner, el mueble elegido, y el piso y el papel tapiz. Todo lo valida el servidor.
import { catalogItem, getWorld, isPlaceable } from "@hyvento/map";
import { C, drawFurniture, type RGBA } from "@hyvento/map/art";
import { OFFICE_FLOORS, OFFICE_WALLPAPERS, shopItem, type InventoryEntry, type OfficeFloor, type OfficeWallpaper } from "@hyvento/shared";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendOfficeEdit } from "@/game/network";
import { selectMyOffice, useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { api } from "./PointsPanels";

const FLOOR_LABEL: Record<OfficeFloor, string> = {
  carpet: "Alfombrado",
  wood: "Madera",
  tiles: "Baldosas",
  stone: "Piedra",
  planks: "Tablas claras",
  checker: "Damero",
  hydraulic: "Hidráulica",
  terrazzo: "Terrazo",
  brick: "Barro cocido",
  moquette: "Moqueta",
  concrete: "Concreto",
  "planks-worn": "Tablones",
};
const WALLPAPER_LABEL: Record<OfficeWallpaper, string> = {
  cream: "Crema",
  blue: "Azul",
  rose: "Rosa",
  sage: "Salvia",
  stripes: "Rayas",
  damask: "Damasco",
  brick: "Ladrillo",
  slats: "Listones",
  colonial: "Colonial",
  cinderblock: "Bloque",
  boards: "Tablas",
};

const css = (c: RGBA | undefined) => (c ? `rgb(${c[0]} ${c[1]} ${c[2]})` : "transparent");
/** El alfombrado toma el color del papel tapiz (como en el mapa, ver CARPET de art/room.ts). */
const CARPET_RAMP: Record<OfficeWallpaper, readonly RGBA[]> = {
  cream: C.cream,
  blue: C.blue,
  rose: C.rose,
  sage: C.green,
  stripes: C.blue,
  damask: C.mustard,
  brick: C.terracotta,
  slats: C.cream,
  colonial: C.green,
  cinderblock: C.stone,
  boards: C.rug,
};

function floorSwatch(floor: OfficeFloor, wallpaper: OfficeWallpaper): string {
  switch (floor) {
    case "wood":
      return `repeating-linear-gradient(0deg, ${css(C.wood[1])} 0 1px, ${css(C.wood[3])} 1px 7px)`;
    case "carpet": {
      // El papel de la sala puede no estar en la lista (si el mapa trae otro): crema por defecto.
      const r = CARPET_RAMP[wallpaper] ?? C.cream;
      return `radial-gradient(${css(r[2])} 25%, transparent 30%) 0 0 / 5px 5px, ${css(r[3])}`;
    }
    case "tiles":
      return `repeating-conic-gradient(${css(C.cream[4])} 0 25%, ${css(C.terracotta[3])} 0 50%) 0 0 / 12px 12px`;
    case "stone":
      return `radial-gradient(${css(C.stone[4])} 45%, ${css(C.dirt[2])} 55%) 0 0 / 8px 7px`;
    case "planks":
      return `repeating-linear-gradient(0deg, ${css(C.cream[1])} 0 1px, ${css(C.cream[3])} 1px 6px)`;
    case "checker":
      return `repeating-conic-gradient(${css(C.wood[4])} 0 25%, ${css(C.woodDark[4])} 0 50%) 0 0 / 10px 10px`;
    case "hydraulic":
      return `radial-gradient(circle at 0 0, ${css(C.rug[2])} 30%, transparent 32%) 0 0 / 8px 8px, radial-gradient(${css(C.sage[2])} 20%, ${css(C.cream[4])} 24%) 0 0 / 8px 8px`;
    case "terrazzo":
      return `radial-gradient(${css(C.rose[3])} 12%, transparent 16%) 1px 2px / 5px 6px, radial-gradient(${css(C.stone[3])} 12%, transparent 16%) 3px 0 / 7px 5px, ${css(C.cream[4])}`;
    case "brick":
      return `repeating-linear-gradient(0deg, ${css(C.stone[2])} 0 1px, ${css(C.terracotta[3])} 1px 5px)`;
    case "moquette":
      return `repeating-linear-gradient(45deg, ${css(C.mustard[2])} 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, ${css(C.mustard[2])} 0 1px, ${css(C.green[2])} 1px 6px)`;
    case "planks-worn":
      return `repeating-linear-gradient(0deg, ${css(C.woodDark[1])} 0 1px, ${css(C.wood[3])} 1px 8px)`;
    case "concrete":
      // Gris con una mancha de aceite.
      return `radial-gradient(circle at 70% 35%, ${css(C.stone[0])} 18%, transparent 22%), ${css(C.stone[2])}`;
  }
}

function wallpaperSwatch(w: OfficeWallpaper): string {
  switch (w) {
    case "stripes":
      return `repeating-linear-gradient(90deg, ${css(C.blue[3])} 0 1px, ${css(C.cream[4])} 1px 4px, ${css(C.rose[3])} 4px 5px, ${css(C.cream[4])} 5px 8px)`;
    case "damask":
      return `radial-gradient(${css(C.mustard[3])} 30%, transparent 34%) 0 0 / 8px 10px, ${css(C.mustard[2])}`;
    case "brick":
      return `repeating-linear-gradient(0deg, ${css(C.cream[2])} 0 1px, ${css(C.terracotta[3])} 1px 5px)`;
    case "slats":
      return `repeating-linear-gradient(90deg, ${css(C.woodDark[1])} 0 1px, ${css(C.cream[3])} 1px 4px)`;
    case "colonial":
      return `linear-gradient(0deg, ${css(C.sage[1])} 0 40%, ${css(C.mustard[3])} 40% 48%, ${css(C.cream[5])} 48%)`;
    case "boards":
      return `linear-gradient(0deg, ${css(C.stone[2])} 0 22%, transparent 22%), repeating-linear-gradient(0deg, ${css(C.woodDark[1])} 0 1px, ${css(C.logs[3])} 1px 6px)`;
    case "cinderblock":
      return `repeating-linear-gradient(0deg, ${css(C.stone[1])} 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, ${css(C.stone[1])} 0 1px, ${css(C.stone[2])} 1px 10px)`;
    default: {
      const r = { cream: C.cream, blue: C.blue, rose: C.rose, sage: C.sage }[w];
      return `repeating-linear-gradient(90deg, ${css(r[2])} 0 2px, ${css(r[3])} 2px 10px)`;
    }
  }
}

const artCache = new Map<string, string>();

/** El mueble en pixel-art, ampliado sin suavizar (se dibuja en el navegador). */
export function FurnitureArt({ type }: { type: string }) {
  const [src, setSrc] = useState(() => artCache.get(type) ?? null);
  useEffect(() => {
    if (artCache.has(type)) return setSrc(artCache.get(type)!);
    const url = toHtmlCanvas(drawFurniture(type, "front").canvas).toDataURL();
    artCache.set(type, url);
    setSrc(url);
  }, [type]);
  return (
    <span className="grid h-12 w-full place-items-center">
      {src && <img src={src} alt="" className="max-h-12 max-w-full object-contain [image-rendering:pixelated]" />}
    </span>
  );
}

const nameOf = (type: string) => shopItem(type)?.name ?? catalogItem(type).name;

export function DecorPanel() {
  const myOffice = useOfficeStore(useShallow(selectMyOffice));
  const zoneId = useOfficeStore((s) => s.zone?.id);
  const pick = useOfficeStore((s) => s.decorPick);
  const result = useOfficeStore((s) => s.decorResult);
  const { setDecorating, pickDecor, rotateDecor } = useOfficeStore.getState();
  const [backpack, setBackpack] = useState<InventoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Decorar es solo dentro de tu oficina: al salir (o si deja de ser tuya) se termina.
  useEffect(() => {
    if (!myOffice || zoneId !== myOffice.zoneId) setDecorating(false);
  }, [myOffice, zoneId, setDecorating]);

  const load = useCallback(() => {
    setError(null);
    api<{ inventory: InventoryEntry[] }>("/api/inventory").then(
      (r) => setBackpack(r.inventory.filter((i) => i.quantity > 0 && isPlaceable(i.itemId))),
      (e: Error) => setError(e.message || "No se pudo abrir la mochila."),
    );
  }, []);
  useEffect(load, [load]);
  // Cada cambio que guarda el servidor puede sacar o devolver algo a la mochila.
  useEffect(() => {
    if (result?.ok) load();
  }, [result, load]);
  // Se acabaron las unidades del que estabas poniendo: se suelta.
  useEffect(() => {
    if (backpack && pick && !pick.itemId && !backpack.some((i) => i.itemId === pick.type)) pickDecor(null);
  }, [backpack, pick, pickDecor]);

  if (!myOffice) return null;
  const room = getWorld().areas.get("piso-2")?.def.rooms.find((r) => r.id === myOffice.zoneId);
  const floor = (myOffice.floor || room?.floor || "carpet") as OfficeFloor;
  const wallpaper = (myOffice.wallpaper || room?.wallpaper || "cream") as OfficeWallpaper;
  const style = (s: { floor?: OfficeFloor; wallpaper?: OfficeWallpaper }) => sendOfficeEdit({ action: "style", zoneId: myOffice.zoneId, ...s });
  const remove = () => {
    if (!pick?.itemId) return;
    sendOfficeEdit({ action: "remove", zoneId: myOffice.zoneId, itemId: pick.itemId });
    pickDecor(null);
  };

  return (
    <section aria-label="Decorar tu oficina" className="cozy-panel pointer-events-auto flex max-h-[calc(100dvh-9rem)] w-full flex-col p-1.5">
      <header className="flex items-center gap-2 bg-cozy-wood px-3 py-2 text-cozy-paper-light">
        <PixelIcon name="home" size={14} />
        <h2 className="flex-1 text-[16px] font-semibold">Decorar</h2>
        <button type="button" onClick={() => setDecorating(false)} className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[13px]">
          Listo
        </button>
      </header>

      <div className="cozy-scroll flex min-h-0 flex-col gap-4 overflow-y-auto px-2.5 py-3">
        {pick ? (
          <div className="flex flex-col gap-2 border-2 border-cozy-wood bg-cozy-paper-light px-2.5 py-2">
            <p className="text-[14px] leading-tight">
              {pick.itemId ? "Moviendo" : "Poniendo"}: <span className="font-semibold">{nameOf(pick.type)}</span>
            </p>
            <p className="text-[12px] leading-snug text-cozy-ink-soft">Clic en tu oficina para dejarlo. Verde: se puede; rojo: no.</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={rotateDecor} className="cozy-btn px-2 py-1 text-[13px]">
                Girar <kbd className="cozy-kbd">R</kbd>
              </button>
              {pick.itemId && (
                <button type="button" onClick={remove} className="cozy-btn cozy-btn-danger px-2 py-1 text-[13px]">
                  Guardar en la mochila
                </button>
              )}
              <button type="button" onClick={() => pickDecor(null)} className="cozy-btn px-2 py-1 text-[13px]">
                Soltar <kbd className="cozy-kbd">Esc</kbd>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-cozy-ink-soft">
            Elige un mueble de tu mochila, o haz clic en uno de tu oficina para moverlo o guardarlo. El escritorio con el PC
            y su silla no se mueven.
          </p>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-[14px] font-semibold">Mochila</h3>
          {error ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-[13px] font-semibold text-cozy-red-deep">{error}</p>
              <button type="button" onClick={load} className="cozy-btn px-2 py-1 text-[13px]">
                Reintentar
              </button>
            </div>
          ) : !backpack ? (
            <p className="text-[13px] text-cozy-ink-soft">Abriendo la mochila…</p>
          ) : backpack.length === 0 ? (
            <p className="text-[13px] leading-snug text-cozy-ink-soft">
              No tienes muebles guardados. Cómpralos en la tienda de la planta baja, o guarda uno de tu oficina.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-1.5">
              {backpack.map((i) => (
                <li key={i.itemId}>
                  <button
                    type="button"
                    onClick={() => pickDecor(pick?.type === i.itemId && !pick.itemId ? null : { type: i.itemId })}
                    aria-pressed={pick?.type === i.itemId && !pick.itemId}
                    title={nameOf(i.itemId)}
                    className="cozy-btn relative flex h-full w-full flex-col gap-1 px-1 py-1.5"
                  >
                    <FurnitureArt type={i.itemId} />
                    <span className="w-full truncate text-center text-[11px] leading-tight">{nameOf(i.itemId)}</span>
                    {i.quantity > 1 && (
                      <span className="absolute top-0.5 right-1 text-[11px] leading-none text-cozy-ink-soft">×{i.quantity}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[14px] font-semibold">Piso</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {OFFICE_FLOORS.map((f) => (
              <button key={f} type="button" onClick={() => style({ floor: f })} aria-pressed={floor === f} className="cozy-btn justify-start px-1.5 py-1 text-[13px]">
                <span className="h-5 w-5 shrink-0 border-2 border-cozy-frame" style={{ background: floorSwatch(f, wallpaper) }} />
                {FLOOR_LABEL[f]}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[14px] font-semibold">Papel tapiz</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {OFFICE_WALLPAPERS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => style({ wallpaper: w })}
                aria-pressed={wallpaper === w}
                className="cozy-btn justify-start px-1.5 py-1 text-[13px]"
              >
                <span className="h-5 w-5 shrink-0 border-2 border-cozy-frame" style={{ background: wallpaperSwatch(w) }} />
                {WALLPAPER_LABEL[w]}
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
