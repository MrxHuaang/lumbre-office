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

const FLOOR_LABEL: Record<OfficeFloor, string> = { carpet: "Alfombrado", wood: "Madera", tiles: "Baldosas", stone: "Piedra" };
const WALLPAPER_LABEL: Record<OfficeWallpaper, string> = { cream: "Crema", blue: "Azul", rose: "Rosa", sage: "Salvia" };

const css = (c: RGBA | undefined) => (c ? `rgb(${c[0]} ${c[1]} ${c[2]})` : "transparent");
/** Muestra de cada papel tapiz: sus franjas, con los colores del motor pixel. */
const WALLPAPER_RAMP = { cream: C.cream, blue: C.blue, rose: C.rose, sage: C.sage } as const;
/** El alfombrado toma el color del papel tapiz (como en el mapa). */
const CARPET_RAMP = { cream: C.cream, blue: C.blue, rose: C.rose, sage: C.green } as const;

function floorSwatch(floor: OfficeFloor, wallpaper: OfficeWallpaper): string {
  switch (floor) {
    case "wood":
      return `repeating-linear-gradient(0deg, ${css(C.wood[1])} 0 1px, ${css(C.wood[3])} 1px 7px)`;
    case "carpet":
      return `radial-gradient(${css(CARPET_RAMP[wallpaper][2])} 25%, transparent 30%) 0 0 / 5px 5px, ${css(CARPET_RAMP[wallpaper][3])}`;
    case "tiles":
      return `repeating-conic-gradient(${css(C.cream[4])} 0 25%, ${css(C.terracotta[3])} 0 50%) 0 0 / 12px 12px`;
    case "stone":
      return `radial-gradient(${css(C.stone[4])} 45%, ${css(C.dirt[2])} 55%) 0 0 / 8px 7px`;
  }
}

function wallpaperSwatch(w: OfficeWallpaper): string {
  const r = WALLPAPER_RAMP[w];
  return `repeating-linear-gradient(90deg, ${css(r[2])} 0 2px, ${css(r[3])} 2px 10px)`;
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
