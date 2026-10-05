"use client";

// Piezas comunes de regalos e intercambios: pedir a la API, la mochila, el dibujo de un objeto y la caja
// de regalo animada. No importa PointsPanels (que importa el buzón de regalos): así no hay ciclos.
import { drawFurniture, giftBox, GIFT_BOX_FRAMES } from "@hyvento/map/art";
import { isStoryItem, type InventoryEntry } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { useOfficeStore } from "@/game/store";

export async function socialApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Algo salió mal. Intenta de nuevo.");
  return body;
}

/** Saldo del jugador local (lo lleva el servidor de juego). */
export const useMyBalance = () => useOfficeStore(useShallow((s) => (s.sessionId ? (s.players[s.sessionId]?.points ?? 0) : 0)));

/** Lo de la mochila que se puede dar (se lee al montar; `reload` la vuelve a pedir). Lo de la historia no sale. */
export function useBackpack() {
  const [inventory, setInventory] = useState<InventoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    socialApi<{ inventory: InventoryEntry[] }>("/api/inventory").then(
      (r) => alive && setInventory(r.inventory.filter((e) => !isStoryItem(e.itemId))),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [nonce]);
  return { inventory, error, reload: () => setNonce((n) => n + 1) };
}

const itemArt = new Map<string, string | null>();

/** Un objeto de la mochila dibujado con el motor (el mueble de frente); sin dibujo, una caja vacía. */
export function ItemArt({ itemId, size = 40 }: { itemId: string; size?: number }) {
  const [src, setSrc] = useState(() => itemArt.get(itemId) ?? null);
  useEffect(() => {
    let url = itemArt.get(itemId);
    if (url === undefined) {
      try {
        url = toHtmlCanvas(drawFurniture(itemId).canvas).toDataURL();
      } catch {
        url = null;
      }
      itemArt.set(itemId, url);
    }
    setSrc(url);
  }, [itemId]);
  return (
    <span className="grid shrink-0 place-items-center border-2 border-cozy-wood bg-cozy-paper-dark" style={{ width: size, height: size }}>
      {src && <img src={src} alt="" className="object-contain [image-rendering:pixelated]" style={{ width: size - 8, height: size - 8 }} />}
    </span>
  );
}

const boxFrames: string[] = [];

/**
 * La caja de regalo en pixel. `opening` la anima: se sacude y se abre (y queda abierta). Sin
 * `opening`, quieta y cerrada.
 */
export function GiftBoxArt({ opening = false, scale = 4, onOpened }: { opening?: boolean; scale?: number; onOpened?: () => void }) {
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  // La animación depende solo de `opening`: el aviso de "se abrió" se lee de una ref.
  const opened = useRef(onOpened);
  opened.current = onOpened;
  useEffect(() => {
    if (boxFrames.length === 0) for (let f = 0; f < GIFT_BOX_FRAMES; f++) boxFrames.push(toHtmlCanvas(giftBox(f)).toDataURL());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!opening) return setFrame(0);
    // Se sacude dos veces y después salta la tapa: 1, 2, 1, 2, 3, 4, 5.
    const plan = [1, 2, 1, 2, 3, 4, 5];
    let i = 0;
    const timer = setInterval(() => {
      setFrame(plan[i]!);
      if (++i >= plan.length) {
        clearInterval(timer);
        opened.current?.();
      }
    }, 130);
    return () => clearInterval(timer);
  }, [opening]);
  const src = ready ? boxFrames[frame] : undefined;
  return (
    <span className="inline-block shrink-0" style={{ width: 22 * scale, height: 24 * scale }}>
      {src && <img src={src} alt="" className="h-full w-full [image-rendering:pixelated]" />}
    </span>
  );
}
