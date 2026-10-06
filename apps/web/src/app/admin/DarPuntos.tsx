"use client";

import { DAR_PUNTOS } from "@hyvento/shared";
import { useState, useTransition } from "react";
import { darPuntosAction } from "./actions";

interface Props {
  users: { id: string; name: string; email: string; points: number }[];
  /** Quien está en /admin: viene elegido por defecto. */
  meId: string;
}

const fmt = (n: number) => n.toLocaleString("es-CO");

/** Dar puntos a alguien del equipo (VIR-185): queda en el libro como ADMIN y llega a la cabaña al instante. */
export function DarPuntos({ users, meId }: Props) {
  const [userId, setUserId] = useState(users.some((u) => u.id === meId) ? meId : (users[0]?.id ?? ""));
  const [amount, setAmount] = useState(String(DAR_PUNTOS.atajos[1]));
  const [result, setResult] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const n = Number(amount);
  const valido = Number.isInteger(n) && n >= 1 && n <= DAR_PUNTOS.max;
  const elegido = users.find((u) => u.id === userId);

  const dar = () => {
    if (!valido || !userId) return;
    setResult(null);
    start(async () => setResult(await darPuntosAction(userId, n)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-[14px]">
          Para
          <select className="cozy-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} · {fmt(u.points)} puntos{u.id === meId ? " (tú)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-36 flex-col gap-1 text-[14px]">
          Cuántos
          <input
            className="cozy-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={DAR_PUNTOS.max}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button type="button" onClick={dar} disabled={!valido || !userId || pending} className="cozy-btn cozy-btn-primary px-4 py-2">
          {pending ? "Dando…" : "Dar puntos"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {DAR_PUNTOS.atajos.map((a) => (
          <button key={a} type="button" className="cozy-btn px-2.5 py-1 text-[13px]" aria-pressed={n === a} onClick={() => setAmount(String(a))}>
            {fmt(a)}
          </button>
        ))}
      </div>
      {!valido && <p className="text-[13px] text-cozy-red">Un número entero entre 1 y {fmt(DAR_PUNTOS.max)}.</p>}
      {result?.ok && <p className="text-[14px] text-cozy-green">{result.ok}</p>}
      {result?.error && <p className="text-[14px] text-cozy-red">{result.error}</p>}
      <p className="text-[13px] text-cozy-ink-soft">
        Queda en el libro de puntos como &quot;Admin&quot;, con quién lo dio. {elegido ? `Ahora ${elegido.name || elegido.email} tiene ${fmt(elegido.points)}.` : ""}
      </p>
    </div>
  );
}
