"use client";

// La recepción del recibidor: Doña Gloria pregunta "¿A quién busca?" y dice dónde anda cada uno de los
// conectados (una oficina cerrada es solo "en su oficina": no se cuenta más) con un botón para ir hasta la
// persona. Lo que se muestra ya lo ve cualquiera en la lista de conectados.
import { getWorld } from "@hyvento/map";
import { isCasaArea, lineSeed, pickLine, RECEPCION_ASK, RECEPCION_NPC, whereText } from "@hyvento/shared";
import { useMemo } from "react";
import { useOfficeStore } from "@/game/store";
import { CharacterSprite } from "../CharacterSprite";
import { PixelIcon } from "../Cozy";
import { PanelShell } from "../PointsPanels";

export function ReceptionPanel({ onClose }: { onClose: () => void }) {
  const players = useOfficeStore((s) => s.players);
  const me = useOfficeStore((s) => s.sessionId);
  const offices = useOfficeStore((s) => s.offices);
  const zoneNames = useOfficeStore((s) => s.zoneNames);
  const walkToPlayer = useOfficeStore((s) => s.walkToPlayer);
  const ask = useMemo(() => pickLine(RECEPCION_ASK, lineSeed(`${me}:${Math.floor(Date.now() / 60_000)}`)), [me]);

  const people = Object.values(players)
    .filter((p) => p.sessionId !== me)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      // En su casa no se dice más: es suya.
      const areaName = getWorld().areas.get(p.area)?.name ?? (isCasaArea(p.area) ? "Su casa" : "La cabaña");
      const office = offices[p.zoneId];
      const door = p.place.startsWith("door:");
      return {
        p,
        where: whereText({
          areaName,
          zoneName: zoneNames[p.zoneId] ?? "",
          office: office ? { mine: office.ownerId === p.userId, locked: office.locked } : undefined,
          atDoor: door,
        }),
      };
    });

  const go = (sessionId: string) => {
    walkToPlayer(sessionId);
    onClose();
  };

  return (
    <PanelShell title="Recepción" icon="bell" onClose={onClose}>
      <div className="flex items-end gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 pt-2 pb-2">
        <CharacterSprite avatar="ada" look={RECEPCION_NPC.look} className="h-20 w-20 shrink-0" />
        <div className="mb-1 flex-1">
          <p className="text-[13px] font-semibold text-cozy-wood">{RECEPCION_NPC.name}</p>
          <p className="text-[15px] leading-snug">«{people.length ? ask : "Ahorita no hay nadie más en la casa, mijo. ¿Le provoca un tintico mientras llegan?"}»</p>
        </div>
      </div>
      {people.length > 0 && (
        <ul className="mt-3 flex flex-col">
          {people.map(({ p, where }) => (
            <li key={p.sessionId} className="flex items-center gap-2 border-b-2 border-cozy-paper-dark py-1.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                <span className="block truncate text-[13px] text-cozy-ink-soft">{where}</span>
              </span>
              <button type="button" onClick={() => go(p.sessionId)} title={`Ir hasta ${p.name}`} className="cozy-btn flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[14px]">
                <PixelIcon name="steps" size={14} color="var(--color-cozy-wood)" />
                Ir
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
