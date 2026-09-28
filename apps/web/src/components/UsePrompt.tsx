"use client";

// Rediseño: la ayuda "E" junto a un mueble que se usa (tele, lámparas, tocadiscos, piano…). Lo de la mano
// (F) y el brindis (B) están en la barra de abajo (bag/Hotbar.tsx).
import { sendFurnitureUse, sendPetAction } from "@/game/network";
import { PET_USABLE_PREFIX, useOfficeStore } from "@/game/store";

/** Ayuda junto a un mueble que se usa: tecla E o clic. */
export function UsablePrompt() {
  const usable = useOfficeStore((s) => s.usable);
  const panel = useOfficeStore((s) => s.panel);
  const door = useOfficeStore((s) => s.doorPrompt);
  const decorating = useOfficeStore((s) => s.decorating);
  if (!usable || panel || door || decorating) return null;
  return (
    <button
      type="button"
      onClick={() =>
        // La "E" de una mascota (acariciarla) va por su propio mensaje.
        usable.type.startsWith(PET_USABLE_PREFIX) ? sendPetAction(usable.type.slice(PET_USABLE_PREFIX.length), "pet") : sendFurnitureUse(usable.type, usable.x, usable.y)
      }
      className="cozy-chip pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[14px]"
    >
      <kbd className="cozy-kbd">E</kbd>
      {usable.label}
    </button>
  );
}
