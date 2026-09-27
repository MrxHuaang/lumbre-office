"use client";

// Fase 4: la caja del casino. Tus números, los rankings (quién más ganó, quién más perdió y los cobros
// más grandes) y las estadísticas de cada juego, de la semana o desde siempre. Es una ventanilla con el
// estilo de las mesas: marco de caoba, reja de bronce, paño verde y los números pixel del paño.
import { CASINO_GAME_NAMES, type CasinoGameStats, type CasinoPeriod, type HumanAvatar, type Look } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { CharacterSprite } from "../CharacterSprite";
import { PixelIcon } from "../Cozy";
import { api, PanelShell } from "../PointsPanels";
import { PixelNumber } from "./PixelArt";

interface RankRow {
  userId: string;
  name: string;
  avatar: HumanAvatar;
  look: Look | null;
  net: number;
  best: number;
}

interface CasinoState {
  balance: number;
  enabled: boolean;
  todayNet: number;
  period: CasinoPeriod;
  days: number;
  mine: {
    net: number;
    staked: number;
    paid: number;
    bets: number;
    best: number;
  };
  winners: RankRow[];
  losers: RankRow[];
  bigWins: RankRow[];
  games: CasinoGameStats[];
  total: {
    staked: number;
    paid: number;
    house: number;
    bets: number;
    players: number;
  };
  me: string;
}

type Board = "winners" | "losers" | "bigWins";
const BOARDS: { id: Board; label: string; empty: string }[] = [
  { id: "winners", label: "Más ganaron", empty: "Nadie va ganando todavía." },
  {
    id: "losers",
    label: "Más perdieron",
    empty: "Nadie va perdiendo todavía.",
  },
  { id: "bigWins", label: "Mayores cobros", empty: "Todavía no hay cobros." },
];

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const toneOf = (n: number) => (n > 0 ? "good" : n < 0 ? "bad" : undefined);

/** Colores de la mesa (los mismos del arte del casino). */
const T = {
  felt: "#2e5a40",
  feltLight: "#437a55",
  wood: "#5a331d",
  woodDark: "#3f2416",
  bronze: "#b98424",
  bronzeLight: "#f3d672",
  cream: "#fffaf0",
  good: "#8cc653",
  bad: "#f1b98a",
};

export function CashierPanel({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<CasinoPeriod>("semana");
  const [board, setBoard] = useState<Board>("winners");
  const [data, setData] = useState<CasinoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<CasinoState>(`/api/casino?periodo=${period}`).then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [period]);
  const shown = data?.period === period ? data : null;

  return (
    <PanelShell title="Caja del casino" icon="coin" onClose={onClose} wide>
      {/* Marco de caoba con la reja de bronce arriba: la ventanilla. */}
      <div
        className="border-4 p-1.5"
        style={{
          background: T.wood,
          borderColor: T.woodDark,
          boxShadow: `inset 0 0 0 2px ${T.bronze}`,
        }}
      >
        <div
          aria-hidden
          className="h-5 border-2"
          style={{
            borderColor: T.bronze,
            background: `repeating-linear-gradient(90deg, ${T.bronzeLight} 0 3px, ${T.bronze} 3px 5px, ${T.woodDark} 5px 14px)`,
          }}
        />
        <div
          className="mt-1.5 flex flex-col gap-4 border-2 px-3 py-3"
          style={{ background: T.felt, borderColor: T.bronze, color: T.cream }}
        >
          <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
            {(["semana", "siempre"] as const).map((p) => (
              <Toggle key={p} on={period === p} onClick={() => setPeriod(p)}>
                {p === "semana" ? `Últimos ${data?.days ?? 7} días` : "Desde siempre"}
              </Toggle>
            ))}
          </div>

          {!shown ? (
            <p className="text-[14px]">{error ?? "Contando fichas…"}</p>
          ) : (
            <>
              {!shown.enabled && (
                <p className="border-2 px-3 py-2 text-[14px]" style={{ borderColor: T.bad, color: T.bad }}>
                  El casino está cerrado por ahora (lo decide un admin).
                </p>
              )}
              <section className="flex flex-col gap-2">
                <Heading icon="coin">Tus números</Heading>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Tu saldo" value={String(shown.balance)} coin />
                  <Stat label="Hoy en el casino" value={signed(shown.todayNet)} tone={toneOf(shown.todayNet)} />
                  <Stat label="Ganancia neta" value={signed(shown.mine.net)} tone={toneOf(shown.mine.net)} />
                  <Stat label="Apostado" value={String(shown.mine.staked)} />
                  <Stat label="Mayor cobro" value={String(shown.mine.best)} />
                  <Stat label="Apuestas" value={String(shown.mine.bets)} />
                </div>
                <p className="text-[13px] leading-snug opacity-85">
                  Se apuesta con puntos y no se canjean por nada: es para divertirse. No hay límite diario, solo tu saldo.
                </p>
              </section>

              <section className="flex flex-col gap-2">
                <Heading icon="trophy">Rankings</Heading>
                <div role="tablist" aria-label="Ranking" className="flex flex-wrap gap-1.5">
                  {BOARDS.map((b) => (
                    <Toggle key={b.id} on={board === b.id} onClick={() => setBoard(b.id)} role="tab">
                      {b.label}
                    </Toggle>
                  ))}
                </div>
                <Ranking
                  rows={shown[board]}
                  me={shown.me}
                  value={(r) => (board === "bigWins" ? String(r.best) : signed(r.net))}
                  tone={(r) => (board === "bigWins" ? "good" : toneOf(r.net))}
                  empty={BOARDS.find((b) => b.id === board)!.empty}
                />
              </section>

              <section className="flex flex-col gap-2">
                <Heading icon="trophy">Estadísticas del casino</Heading>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Jugadores" value={String(shown.total.players)} />
                  <Stat label="Apuestas" value={String(shown.total.bets)} />
                  <Stat label="Apostado" value={String(shown.total.staked)} />
                  <Stat label="La casa" value={signed(shown.total.house)} tone={toneOf(shown.total.house)} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] border-2 text-left text-[14px]" style={{ borderColor: T.bronze }}>
                    <thead style={{ background: T.woodDark, color: T.bronzeLight }}>
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Juego</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Jugadores</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Apuestas</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Apostado</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.games.map((g) => (
                        <tr key={g.game} className="border-t-2" style={{ borderColor: T.feltLight }}>
                          <td className="px-2 py-1.5">{CASINO_GAME_NAMES[g.game]}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{g.players}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{g.bets}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{g.staked}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{g.paid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[13px] leading-snug opacity-85">
                  "Pagado" suma premios y devoluciones. "La casa" es lo apostado menos lo pagado: si es positivo, el casino va ganando.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function Heading({ icon, children }: { icon: "coin" | "trophy"; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: T.bronzeLight }}>
      <PixelIcon name={icon} size={14} color={T.bronzeLight} />
      {children}
    </p>
  );
}

/** Botón de bronce que se enciende al elegirlo (período o ranking). */
function Toggle({ on, onClick, role, children }: { on: boolean; onClick: () => void; role?: "tab"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role={role}
      aria-pressed={role ? undefined : on}
      aria-selected={role ? on : undefined}
      onClick={onClick}
      className="border-2 px-2.5 py-1 text-[13px]"
      style={{
        borderColor: T.bronze,
        background: on ? T.bronze : T.woodDark,
        color: on ? T.woodDark : T.bronzeLight,
      }}
    >
      {children}
    </button>
  );
}

function Ranking({
  rows,
  me,
  value,
  tone,
  empty,
}: {
  rows: RankRow[];
  me: string;
  value: (r: RankRow) => string;
  tone: (r: RankRow) => "good" | "bad" | undefined;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-[14px] opacity-85">{empty}</p>;
  return (
    <ol className="border-2" style={{ borderColor: T.bronze }}>
      {rows.map((r, i) => {
        const t = tone(r);
        return (
          <li
            key={r.userId}
            className="flex items-center gap-3 border-b-2 px-2 py-1.5 text-[15px] last:border-b-0"
            style={{
              borderColor: T.feltLight,
              background: r.userId === me ? T.feltLight : undefined,
            }}
          >
            <span className="grid w-7 place-items-center">
              <PixelNumber value={i + 1} scale={2} color={i === 0 ? T.bronzeLight : T.cream} outline={T.woodDark} />
            </span>
            <CharacterSprite avatar={r.avatar} look={r.look} dir="right" className="w-8 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {r.name}
              {r.userId === me && " (tú)"}
            </span>
            <PixelNumber value={value(r)} scale={2} color={t === "good" ? T.good : t === "bad" ? T.bad : T.cream} outline={T.woodDark} />
          </li>
        );
      })}
    </ol>
  );
}

/** Placa de bronce sobre el paño, con el valor en números pixel. */
function Stat({ label, value, coin, tone }: { label: string; value: string; coin?: boolean; tone?: "good" | "bad" }) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 border-2 px-2.5 py-2"
      style={{
        borderColor: T.bronze,
        background: T.woodDark,
        boxShadow: `inset 0 0 0 1px ${T.wood}`,
      }}
    >
      <span className="text-[12px] leading-tight" style={{ color: T.bronzeLight }}>
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        {coin && <PixelIcon name="coin" size={14} color={T.bronzeLight} />}
        {/* En pantallas angostas el número se achica (el SVG escala) en vez de salirse de la placa. */}
        <PixelNumber
          value={value}
          scale={3}
          color={tone === "good" ? T.good : tone === "bad" ? T.bad : T.cream}
          outline="#140f18"
          className="h-auto max-w-full min-w-0"
        />
      </span>
    </div>
  );
}
