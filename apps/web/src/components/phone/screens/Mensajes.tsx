"use client";

// Mensajes: el chat de la cabaña vive aquí. Dos pestañas como el chat de antes (Cerca: quienes te oyen
// o los de la sala; Global: toda la cabaña), la conversación de la pestaña y abajo lo que escribes.
// Se escribe con el teclado de verdad (Enter manda) o a lo antiguo, con el multi-toque del teclado
// numérico. La pestaña elegida es a quién le llega.
import type { ChatScope } from "@hyvento/shared";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "@/game/network";
import { phoneSounds } from "@/game/phone/audio";
import { bogotaTime, hhmm } from "@/game/phone/hora";
import { usePhoneStore } from "@/game/phone/state";
import { append, backspace, CHAT_MAX, cycleMode, emptyT9, MULTITAP_MS, pressKey, settle, smsCounter, type T9State } from "@/game/phone/t9";
import { useOfficeStore } from "@/game/store";
import { nameInk } from "@/lib/cozy";
import { useHearingText, usePhone, usePhoneKeys, type AppParams } from "../kit";

const SCOPES: ChatScope[] = ["proximity", "global"];

// Lo escrito y la pestaña se recuerdan mientras dure la visita: guardar el celular no borra el borrador.
let draft: T9State = emptyT9("", "Abc", CHAT_MAX);
let lastScope: ChatScope = "proximity";

export function MensajesApp({ params }: { params?: AppParams }) {
  const { back, close } = usePhone();
  const messages = useOfficeStore((s) => s.messages);
  const sessionId = useOfficeStore((s) => s.sessionId);
  const zone = useOfficeStore((s) => s.zone);
  const readUntil = usePhoneStore((s) => s.readUntil);
  const hearing = useHearingText();
  const [scope, setScope] = useState<ChatScope>(params?.compose?.scope ?? lastScope);
  const [t9, setT9] = useState<T9State>(() =>
    params?.compose?.text ? emptyT9(params.compose.text, "abc", CHAT_MAX) : draft,
  );
  const [blink, setBlink] = useState(true);
  const [flying, setFlying] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  // El texto al día aunque React todavía no haya vuelto a pintar: las teclas en fila (lo tecleado
  // mientras se abría la tapa) llegan todas juntas, y un Enter al final tiene que mandar todo.
  const cur = useRef(t9);
  const update = (f: (s: T9State) => T9State) => {
    cur.current = f(cur.current);
    setT9(cur.current);
  };
  const stuck = useRef(true);
  draft = t9;
  lastScope = scope;

  const visible = useMemo(() => messages.filter((m) => m.scope === scope), [messages, scope]);
  // Hay nuevos en la otra pestaña: un puntito la marca.
  const otherUnread = useMemo(
    () => messages.some((m) => m.scope !== scope && m.fromId !== sessionId && m.ts > readUntil),
    [messages, scope, sessionId, readUntil],
  );

  // Con Mensajes a la vista, lo que llega de esta pestaña ya está leído (la otra queda marcada).
  const newest = visible.at(-1)?.ts ?? 0;
  useEffect(() => {
    if (!otherUnread) usePhoneStore.getState().markRead(newest);
  }, [newest, otherUnread]);

  // La conversación baja sola con cada mensaje, salvo que estés leyendo más arriba.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [visible.length, scope]);

  // La letra a prueba del multi-toque queda escrita sola al segundo.
  useEffect(() => {
    if (!t9.pending) return;
    const id = setTimeout(() => update((s) => settle(s, Date.now())), MULTITAP_MS + 20);
    return () => clearTimeout(id);
  }, [t9.pending]);
  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(id);
  }, []);
  // La cartita que sale volando al mandar.
  useEffect(() => {
    if (!flying) return;
    const id = setTimeout(() => setFlying(false), 520);
    return () => clearTimeout(id);
  }, [flying]);

  const send = () => {
    const text = settle(cur.current).text.trim();
    if (!text) return;
    sendChat(text, scope);
    phoneSounds.sent();
    update(() => emptyT9("", "Abc", CHAT_MAX));
    setFlying(true);
    stuck.current = true;
  };
  const switchTab = () => {
    // Al cambiar de pestaña se lee la nueva: lo de la anterior ya se vio.
    usePhoneStore.getState().markRead(newest);
    stuck.current = true;
    setScope((s) => (s === "global" ? "proximity" : "global"));
  };
  const scroll = (dy: number) => {
    const el = list.current;
    if (!el) return;
    el.scrollTop += dy;
    stuck.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  };
  const leave = () => (params?.quick ? close() : back());

  usePhoneKeys(
    (k, physical) => {
      // Con el teclado de verdad, números y signos se escriben tal cual.
      if (physical && k.length === 1) return update((s) => append(s, k)), true;
      if (k.startsWith("char:")) return update((s) => append(s, k.slice(5))), true;
      if (k.length === 1 && k >= "0" && k <= "9") return update((s) => pressKey(s, k, Date.now())), true;
      if (k === "*") return update(cycleMode), true;
      if (k === "#" || k === "left" || k === "right") return switchTab(), true;
      if (k === "up") return scroll(-24), true;
      if (k === "down") return scroll(24), true;
      if (k === "ok" || k === "softL" || k === "call") return send(), true;
      if (k === "esc") return leave(), true;
      if (k === "back" || k === "softR") {
        if (cur.current.text) update(backspace);
        else leave();
        return true;
      }
      return false;
    },
    { left: t9.text ? "Enviar" : undefined, center: t9.mode, right: t9.text ? "Borrar" : "Atrás" },
  );

  const tabName = (s: ChatScope) => (s === "global" ? "Global" : zone?.isolated ? zone.name : "Cerca");
  const pendingChar = t9.pending ? t9.text.slice(-1) : "";
  const fixed = t9.pending ? t9.text.slice(0, -1) : t9.text;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-cozy-paper">
      {/* Pestañas: clic, flechas izquierda/derecha o #. */}
      <div className="flex h-[17px] shrink-0 items-stretch bg-cozy-wood text-[11px] leading-none" role="tablist" aria-label="Canal">
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === scope}
            onClick={() => s !== scope && switchTab()}
            className={`relative flex min-w-0 flex-1 items-center justify-center truncate px-1 ${
              s === scope ? "bg-cozy-paper text-cozy-ink" : "text-cozy-paper-light"
            }`}
          >
            <span className="truncate">{tabName(s)}</span>
            {s !== scope && otherUnread && <span className="ml-1 h-[5px] w-[5px] shrink-0 bg-cozy-red" />}
          </button>
        ))}
      </div>
      {scope === "proximity" && (
        <div className="shrink-0 truncate border-b border-cozy-paper-dark px-1.5 py-[1px] text-[9px] leading-tight text-cozy-ink-soft">
          {zone?.isolated ? `Te oyen todos los de ${zone.name}` : (hearing ?? "Nadie te oye: acércate a alguien")}
        </div>
      )}
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stuck.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
        }}
        className="phone-scroll flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto px-1.5 py-1"
      >
        {visible.length === 0 && (
          <p className="m-auto px-1 text-center text-[10px] leading-tight text-cozy-ink-soft">
            {scope === "global" ? "Nadie ha escrito en Global todavía." : "Acércate a alguien (o entra a una sala) y escribe."}
          </p>
        )}
        {visible.map((m) => {
          const mine = m.fromId === sessionId;
          return (
            <div key={m.id} className="text-[11px] leading-[1.2] break-words">
              <span className="font-semibold" style={{ color: mine ? "#4a2a1c" : nameInk(m.fromId) }}>
                {mine ? "Tú" : m.fromName}
              </span>
              <span className="ml-1 text-[9px] text-cozy-ink-soft">{hhmm(bogotaTime(m.ts))}</span>
              <p className="text-cozy-ink">{m.text}</p>
            </div>
          );
        })}
      </div>
      {/* Lo que se está escribiendo, con el contador de SMS de antes. */}
      <div className="shrink-0 border-t-2 border-cozy-wood bg-cozy-paper-light px-1.5 py-[2px]">
        <div className="flex justify-between text-[8px] leading-none text-cozy-ink-soft">
          <span>Para: {tabName(scope)}</span>
          <span>{smsCounter(t9)}</span>
        </div>
        <div className="phone-scroll max-h-[38px] min-h-[13px] overflow-y-auto text-[11px] leading-[1.2] break-words whitespace-pre-wrap text-cozy-ink">
          {!t9.text && <span className="text-cozy-placeholder">Escribe y Enter…</span>}
          {fixed}
          {pendingChar && <span className="bg-cozy-sky text-cozy-paper-light">{pendingChar}</span>}
          <span className={blink ? "text-cozy-ink" : "text-transparent"}>|</span>
        </div>
      </div>
      {flying && (
        <svg
          className="phone-fly pointer-events-none absolute right-2 bottom-9"
          width="20"
          height="14"
          viewBox="0 0 10 7"
          shapeRendering="crispEdges"
          aria-hidden
        >
          <rect width="10" height="7" fill="#5b2b0e" />
          <rect x="1" y="1" width="8" height="5" fill="#fdf0c8" />
          <path d="M1 1h1v1h1v1h1v1h2V3h1V2h1V1h1v1H8v1H7v1H6v1H4V4H3V3H2V2H1z" fill="#5b2b0e" />
        </svg>
      )}
    </div>
  );
}
