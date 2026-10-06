"use client";

// La tira del modo mesa del baccarat, los dados y la carrera de caballitos: fichas, saldo, cuenta
// regresiva, los últimos resultados y "Salir". Se apuesta tocando el paño (game/table/mesaTable.ts).
import { HORSES, MESA, MESA_NAMES, mesaResultText, unpackDice, type MesaId } from "@hyvento/shared";
import { useMesasStore } from "@/game/mesas";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelNumber } from "./PixelArt";
import { Balance, ChipPicker, Divider, LeaveButton, Status, Strip, useRemaining } from "./TableStrip";

const CREAM = "#fffaf0";
/** Colores del historial del baccarat (los del paño: jugador azul, banca roja, empate verde). */
const BACCARAT_TILE = [
  { text: "J", bg: "#34507a", name: "Jugador" },
  { text: "B", bg: "#983a3c", name: "Banca" },
  { text: "E", bg: "#1f3a2c", name: "Empate" },
] as const;

const PLAYING_TEXT: Record<MesaId, string> = {
  baccarat: "Reparte el crupier…",
  dados: "¡Se sacuden los dados!",
  caballos: "¡Arrancó la carrera!",
};

const RULES: Record<MesaId, string> = {
  baccarat: "Gana la mano más cerca de 9 · la banca que gana con 6 paga la mitad · PJ y PB: pareja en las dos primeras cartas",
  dados: "Chico, grande, par e impar pierden si salen tres iguales · un número paga por cada dado que lo muestre · las sumas pagan de 6 a 60 por 1",
  caballos: "Apuesta en la botonera al caballito que crees que llega primero: entre más difícil, más paga",
};

function Tile({ text, bg, big = false, latest = false, title }: { text: string; bg: string; big?: boolean; latest?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`grid place-items-center border-2 ${latest ? "border-cozy-gold" : "border-cozy-frame"} ${big ? "h-9 min-w-9 px-1" : "h-6 min-w-6 px-0.5"}`}
      style={{ background: bg }}
    >
      <PixelNumber value={text} scale={big ? 2 : 1} color={CREAM} label={title ?? text} />
    </span>
  );
}

/** Un resultado del historial como casilla. */
function HistoryTile({ table, n, big, latest }: { table: MesaId; n: number; big?: boolean; latest?: boolean }) {
  if (table === "baccarat") {
    const t = BACCARAT_TILE[n] ?? BACCARAT_TILE[2];
    return <Tile text={t.text} bg={t.bg} big={big} latest={latest} title={t.name} />;
  }
  if (table === "dados") {
    const d = unpackDice(n);
    return <Tile text={d.join("")} bg="#2b2331" big={big} latest={latest} title={`${d.join(", ")} (suma ${d[0]! + d[1]! + d[2]!})`} />;
  }
  const h = HORSES[n];
  return <Tile text={String(n + 1)} bg={h?.color ?? "#2b2331"} big={big} latest={latest} title={h?.name} />;
}

export function MesaStrip({ table }: { table: MesaId }) {
  const t = useMesasStore((s) => s.tables[table]);
  const me = useOfficeStore(selectMyUserId);
  const remaining = useRemaining(t);
  const seconds = Math.ceil(remaining / 1000);
  const mine = t.bets.filter((b) => b.userId === me);
  const staked = mine.reduce((a, b) => a + b.amount, 0);
  const players = new Set(t.bets.map((b) => b.userId)).size;

  let status: React.ReactNode;
  if (t.phase === "betting" && seconds > 0) status = <Status text={mine.length ? "Hagan sus apuestas" : "Toca el paño para apostar"} seconds={seconds} />;
  else if (t.phase === "betting") status = <Status text="¡No va más!" />;
  else if (t.phase === "playing") status = <Status text={PLAYING_TEXT[table]} />;
  else
    status = (
      <Status text={t.result.length ? mesaResultText(table, t.result) : "…"}>
        {t.history[0] !== undefined && <HistoryTile table={table} n={t.history[0]} big latest />}
      </Status>
    );

  const info = (
    <>
      <span className="max-w-[42rem] text-center">{RULES[table]}</span>
      {table === "caballos" && (
        <span className="flex items-center gap-1" aria-label="Lo que paga cada caballito">
          {HORSES.map((h, i) => (
            <Tile key={h.name} text={`${i + 1}X${h.returns}`} bg={h.color} title={`${h.name}: devuelve ${h.returns} veces lo apostado`} />
          ))}
        </span>
      )}
      <span className="flex items-center gap-1" aria-label="Últimos resultados">
        Últimos:
        {t.history.length === 0 ? " —" : t.history.slice(0, 8).map((n, i) => <HistoryTile key={`${t.round}-${i}`} table={table} n={n} latest={i === 0} />)}
      </span>
      <span>
        Tu apuesta: <b className="text-cozy-ink">{staked}</b>
        {mine.length > 0 && ` (${mine.length}/${MESA.maxBetsPerRound})`}
      </span>
      <span>{players === 0 ? "Nadie ha apostado" : players === 1 ? "1 persona apostando" : `${players} personas apostando`}</span>
    </>
  );
  return (
    <Strip label={`Mesa de ${MESA_NAMES[table].toLowerCase()}`} info={info}>
      <ChipPicker disabled={t.phase !== "betting"} />
      <Divider />
      <Balance />
      <Divider />
      {status}
      <LeaveButton text="Salir" />
    </Strip>
  );
}
