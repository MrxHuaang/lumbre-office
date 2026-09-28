"use client";

// Reloj con alarma (hora de Bogotá), calculadora y cámara (saca una foto de la cabaña con el mismo
// sistema de fotos del juego: el celular se guarda y el servidor cuenta 3, 2, 1).
import { useEffect, useState } from "react";
import { CALC_OPS, calcBack, calcDigit, calcDot, calcEquals, calcNextOp, calcOp, emptyCalc, type CalcOp } from "@/game/phone/calc";
import { bogotaTime, hhmm, pad2, parseAlarmDigits } from "@/game/phone/hora";
import { usePhoneStore } from "@/game/phone/state";
import { takePhoto } from "../../PhotoPanels";
import { Flash, ScreenTitle, usePhone, usePhoneKeys } from "../kit";
import { dateText, useNow } from "./Home";

const isDigit = (k: string) => k.length === 1 && k >= "0" && k <= "9";
const charOf = (k: string) => (k.startsWith("char:") ? k.slice(5) : "");

export function RelojApp() {
  const { back } = usePhone();
  const alarm = usePhoneStore((s) => s.alarm);
  const now = bogotaTime(useNow(500));
  const [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1000);
    return () => clearTimeout(id);
  }, [flash]);

  const save = (patch: Partial<typeof alarm>, text: string) => {
    usePhoneStore.getState().setPrefs({ alarm: { ...alarm, firedOn: "", ...patch } });
    setFlash(text);
  };

  usePhoneKeys(
    (k) => {
      const d = isDigit(k) ? k : isDigit(charOf(k)) ? charOf(k) : "";
      if (editing !== null) {
        if (d) return setEditing((v) => ((v ?? "") + d).slice(0, 4)), true;
        if (k === "ok" || k === "softL") {
          const t = parseAlarmDigits(editing);
          if (!t) return setFlash("Hora no válida (HHMM)"), true;
          save({ ...t, on: true }, `Alarma a las ${hhmm(t)}`);
          setEditing(null);
          return true;
        }
        if (k === "back" || k === "softR") {
          if (editing) setEditing(editing.slice(0, -1));
          else setEditing(null);
          return true;
        }
        return true;
      }
      if (k === "ok" || k === "softL") return setEditing(""), true;
      if (k === "#") return save({ on: !alarm.on }, alarm.on ? "Alarma apagada" : "Alarma prendida"), true;
      if (k === "softR" || k === "back") return back(), true;
      return false;
    },
    editing !== null ? { left: "Guardar", right: editing ? "Borrar" : "Cancelar" } : { left: "Alarma", center: "#", right: "Atrás" },
  );

  const typed = (editing ?? "").padEnd(4, "-");
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#1d2a44] text-cozy-paper-light">
      <ScreenTitle>Reloj · Bogotá</ScreenTitle>
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
        <span className="text-[30px] leading-none font-semibold" style={{ textShadow: "2px 2px 0 #0c1220" }}>
          {hhmm(now)}
          <span className="text-[16px]">:{pad2(now.s)}</span>
        </span>
        <span className="text-[11px]">{dateText(now)}</span>
        <div className="mt-2 border-2 border-cozy-gold px-2 py-0.5 text-center text-[11px]">
          {editing !== null ? (
            <>
              Nueva alarma: {typed.slice(0, 2)}:{typed.slice(2)}
            </>
          ) : (
            <>
              Alarma {hhmm(alarm)} · {alarm.on ? "Sí" : "No"}
            </>
          )}
        </div>
        <span className="text-[9px] text-[#8a9ac0]">{editing !== null ? "Escribe la hora con 4 números" : "OK: cambiar · #: prender o apagar"}</span>
      </div>
      {flash && <Flash>{flash}</Flash>}
    </div>
  );
}

const OP_KEYS: Record<string, CalcOp> = { "+": "+", "-": "-", x: "×", X: "×", "/": "÷" };

export function CalculadoraApp() {
  const { back } = usePhone();
  const [s, setS] = useState(emptyCalc);
  usePhoneKeys(
    (k) => {
      const c = charOf(k);
      if (isDigit(k) || isDigit(c)) return setS((v) => calcDigit(v, isDigit(k) ? k : c)), true;
      if (k === "*") return setS(calcNextOp), true;
      if (k === "#" || c === "." || c === ",") return setS(calcDot), true;
      if (OP_KEYS[c]) return setS((v) => calcOp(v, OP_KEYS[c]!)), true;
      if (k === "ok" || k === "softL" || c === "=") return setS(calcEquals), true;
      if (k === "back" || k === "softR") {
        if (s.entry === "0" && s.op === null && !s.error) back();
        else setS(calcBack);
        return true;
      }
      return false;
    },
    { left: "=", center: "* op", right: s.entry === "0" && s.op === null ? "Atrás" : "Borrar" },
  );
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-cozy-paper">
      <ScreenTitle>Calculadora</ScreenTitle>
      <div className="m-1 flex flex-col items-end border-2 border-cozy-frame bg-[#b4cf7a] px-1.5 py-1 text-[#233b18]">
        <span className="h-3 text-[10px] leading-none">{s.acc !== null && s.op ? `${s.acc} ${s.op}` : ""}</span>
        <span className="text-[22px] leading-none font-semibold">{s.error ? "Error" : s.entry}</span>
      </div>
      <div className="flex justify-center gap-1 px-1">
        {CALC_OPS.map((o) => (
          <span key={o} className={`w-7 border-2 text-center text-[12px] ${s.op === o && s.fresh ? "border-cozy-red bg-cozy-paper-light" : "border-cozy-wood"}`}>
            {o}
          </span>
        ))}
      </div>
      <p className="mt-auto px-1.5 pb-0.5 text-center text-[9px] text-cozy-ink-soft">* cambia la operación · # coma · OK =</p>
    </div>
  );
}

export function CamaraApp() {
  const { back, close } = usePhone();
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), 400);
    return () => clearInterval(id);
  }, []);
  // Primero se guarda el celular (suelta el teclado del juego) y recién ahí se pide la foto.
  const shoot = () => close(takePhoto);
  usePhoneKeys(
    (k) => {
      if (k === "ok" || k === "softL" || k === "5" || k === "call") return shoot(), true;
      if (k === "softR" || k === "back") return back(), true;
      return false;
    },
    { left: "Foto", right: "Atrás" },
  );
  const corner = "absolute h-3 w-3 border-cozy-paper-light";
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#2a2033] text-cozy-paper-light">
      <span className={`${corner} top-2 left-2 border-t-2 border-l-2`} />
      <span className={`${corner} top-2 right-2 border-t-2 border-r-2`} />
      <span className={`${corner} bottom-2 left-2 border-b-2 border-l-2`} />
      <span className={`${corner} right-2 bottom-2 border-r-2 border-b-2`} />
      <span className="absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 text-[10px]">
        <span className={`h-1.5 w-1.5 ${t % 2 ? "bg-cozy-red" : "bg-transparent"}`} />
        VGA 640x480
      </span>
      <span className="grid h-8 w-8 place-items-center border-2 border-cozy-paper-light">
        <span className="h-2 w-2 bg-cozy-paper-light" />
      </span>
      <span className="mt-2 px-4 text-center text-[11px] leading-tight">OK para sacar una foto de la cabaña</span>
      <span className="mt-0.5 px-4 text-center text-[9px] leading-tight text-[#b8aec8]">El celular se guarda y cuenta 3, 2, 1</span>
    </div>
  );
}
