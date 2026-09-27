"use client";

// La tira del hockey de mesa: lo único que queda en pantalla mientras la cámara mira la mesa (el partido
// se ve en el mundo, dibujado por game/table/hockeyTable.ts). El marcador con los nombres, el saldo, el
// precio y los botones para jugar (con alguien o contra la máquina), la revancha y salir.
import { getWorld, INTERACT_REACH_TILES, pointsOfType } from "@hyvento/map";
import { ARCADE_PRICE, HOCKEY, type HockeySide } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { mySide, sendHockeyJoin, sendHockeyLeave, useHockeyStore, type HockeySideView } from "@/game/arcade/hockey";
import { useCasinoStore } from "@/game/casino";
import { getRoom } from "@/game/network";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PixelNumber } from "../casino/PixelArt";
import { Balance, Divider, LeaveButton, Status, Strip } from "../casino/TableStrip";
import { NEON } from "../club/neon";
import { useMyPoints } from "../PointsPanels";

const SIDE_COLOR = [NEON.pink, NEON.cyan] as const;
const SIDE_NAME = ["rosa", "azul"] as const;

/** Punta de la mesa donde estoy parado (0 = norte, 1 = sur) o null. Se mira cada tanto: la posición no está en el store. */
function useMyEnd(): HockeySide | null {
  const sessionId = useOfficeStore((s) => s.sessionId);
  const area = useOfficeStore((s) => s.area);
  const [end, setEnd] = useState<HockeySide | null>(null);
  useEffect(() => {
    const read = () => {
      const p = sessionId ? getRoom()?.state.players.get(sessionId) : undefined;
      const map = getWorld().areas.get("sotano");
      if (!p || !map || area !== "sotano") return setEnd(null);
      const reach = INTERACT_REACH_TILES * map.tileSize;
      const i = pointsOfType(map, "air_hockey").findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) <= reach);
      setEnd(i === 0 || i === 1 ? i : null);
    };
    read();
    const id = setInterval(read, 300);
    return () => clearInterval(id);
  }, [sessionId, area]);
  return end;
}

/** Hora del servidor que se refresca 4 veces por segundo (para los conteos). */
function useServerNow() {
  const offset = useCasinoStore((s) => s.offset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now + offset;
}

const clockText = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Un lado del marcador: el color, el nombre (o "libre") y los goles. */
function SideScore({ side, p, me }: { side: HockeySide; p: HockeySideView; me: boolean }) {
  const name = p.bot ? "La máquina" : p.name || "libre";
  return (
    <span className={`flex items-center gap-1.5 ${side === 1 ? "flex-row-reverse" : ""}`}>
      <span aria-hidden className="h-4 w-4 border-2 border-cozy-frame" style={{ background: SIDE_COLOR[side] }} />
      <span className={`max-w-[7rem] truncate text-[13px] ${p.name || p.bot ? "text-cozy-ink" : "text-cozy-ink-soft"}`}>
        {me ? "Tú" : name}
      </span>
      <span className="grid h-9 min-w-9 place-items-center border-2 border-cozy-frame bg-[#1e1030] px-1">
        <PixelNumber value={p.score} scale={2} color={SIDE_COLOR[side]} label={`${p.score} goles`} />
      </span>
    </span>
  );
}

/** Botón de pagar y jugar, con el precio en monedas. */
function PayButton({ text, bot = false, disabled }: { text: string; bot?: boolean; disabled: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => sendHockeyJoin(bot)} className={`cozy-btn ${bot ? "" : "cozy-btn-primary"} flex items-center gap-1.5 px-3 py-1.5 text-[14px]`}>
      {text}
      <span className="flex items-center gap-0.5">
        <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />
        <PixelNumber value={ARCADE_PRICE.hockey} scale={1} color="currentColor" />
      </span>
    </button>
  );
}

export function HockeyStrip() {
  const table = useHockeyStore((s) => s.table);
  const meId = useOfficeStore(selectMyUserId);
  const points = useMyPoints();
  const end = useMyEnd();
  const now = useServerNow();
  const side = mySide(table, meId);
  const poor = points < ARCADE_PRICE.hockey;
  const left = table.endsAt - now;

  // Al salir de la mesa (Esc, "Salir" o abrir otro panel) se deja el partido: esperando, se devuelve la
  // moneda; jugando, cuenta como abandono.
  useEffect(() => {
    return () => {
      const { table: t } = useHockeyStore.getState();
      if (mySide(t, selectMyUserId(useOfficeStore.getState())) !== null && t.phase !== "over" && t.phase !== "idle") sendHockeyLeave();
    };
  }, []);

  let status: React.ReactNode;
  let actions: React.ReactNode = null;
  const other = end === null ? null : table.sides[end === 0 ? 1 : 0];
  switch (table.phase) {
    case "idle":
      if (end === null) status = <Status text="Párate en una punta de la mesa para jugar" />;
      else {
        status = <Status text={poor ? `Te faltan monedas (cuesta ${ARCADE_PRICE.hockey})` : `Juegas con el ${SIDE_NAME[end]}`} />;
        actions = (
          <div className="flex items-center gap-1.5">
            <PayButton text="Esperar rival" disabled={poor} />
            <PayButton text="Contra la máquina" bot disabled={poor} />
          </div>
        );
      }
      break;
    case "waiting":
      if (side !== null) {
        status = <Status text="Esperando rival…" seconds={Math.ceil(Math.max(0, left) / 1000)} />;
        actions = (
          <button type="button" onClick={() => sendHockeyJoin(true)} className="cozy-btn px-3 py-1.5 text-[14px]" title="Sin pagar de nuevo">
            Mejor contra la máquina
          </button>
        );
      } else if (end !== null && other && other.userId && !table.sides[end].userId) {
        status = <Status text={`${other.name} te espera`} />;
        actions = <PayButton text="¡A jugar!" disabled={poor} />;
      } else status = <Status text={end === null ? "Alguien espera rival: párate en la otra punta" : "Esa punta está tomada: ve a la otra"} />;
      break;
    case "countdown":
      status = <Status text={side !== null ? "¡Prepárate! Mueve el mouse para llevar tu mazo" : "Empieza el partido…"} />;
      break;
    case "playing":
    case "goal":
      status = (
        <div className="flex items-center gap-2" aria-live="off">
          {table.phase === "playing" && <span className="border-2 border-cozy-frame bg-[#1e1030] px-1.5 py-0.5 text-[14px] text-[#fdf0c8] tabular-nums">{clockText(left)}</span>}
          <span className="text-[14px] leading-tight">{table.phase === "goal" ? "¡Gol!" : side !== null ? "Mouse o flechas: tu mazo" : "Mirando el partido"}</span>
        </div>
      );
      break;
    case "over": {
      const won = table.winner === -1 ? "Empate" : side !== null ? (table.winner === side ? "¡Ganaste!" : "Perdiste") : `Ganó el ${SIDE_NAME[table.winner as HockeySide]}`;
      status = <Status text={`${won}${table.forfeit ? " (abandono)" : ""}`} />;
      break;
    }
  }

  const info = (
    <>
      <span>A {HOCKEY.toWin} goles · cada uno pone {ARCADE_PRICE.hockey} y el ganador se lleva {ARCADE_PRICE.hockey * 2}</span>
      <span>
        A la máquina: si le ganas, te devuelve la moneda y +{ARCADE_PRICE.hockeyBotBonus}
      </span>
      {side !== null && table.phase !== "over" && <span>Salir en pleno partido es abandono</span>}
    </>
  );
  return (
    <Strip label="Mesa de hockey" info={info}>
      <div className="flex items-center gap-2" aria-label="Marcador">
        <SideScore side={0} p={table.sides[0]} me={side === 0} />
        <span className="text-[18px] text-cozy-ink-soft">:</span>
        <SideScore side={1} p={table.sides[1]} me={side === 1} />
      </div>
      <Divider />
      <Balance />
      <Divider />
      {status}
      {actions}
      <LeaveButton text="Salir" />
    </Strip>
  );
}
