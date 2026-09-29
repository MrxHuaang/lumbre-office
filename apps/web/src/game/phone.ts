// El teléfono de escritorio en el navegador: la llamada en curso (lo que manda el servidor en
// `MSG.phoneEvent`), los botones (llamar, contestar, colgar) y el timbre retro, sintetizado con WebAudio.
// Quién se oye durante la llamada no sale de aquí: lo dice el estado (`Player.callWith`), ver OfficeScene.
import { CALL_MEMBER_TEXT, callEndText, MSG, PHONE_ERROR_TEXT, type CallMember, type PhoneEvent } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { useCasinoStore } from "./casino";
import { audible, mixerBus } from "./mixer";
import { sharedAudio } from "./sound";
import { useOfficeStore } from "./store";

export interface PhoneCall {
  callId: string;
  phase: "calling" | "ringing" | "talking";
  withUserId: string;
  withName: string;
  /** Para la llamada que me suena: "su oficina", "la recepción"… */
  from: string;
  /** Hora local en que contestaron (el reloj del chip) o en que deja de sonar. */
  since: number;
  endsAt: number;
  /** Los demás de la llamada (en una grupal, varios; hablando o sonándoles). */
  members: CallMember[];
}

interface PhoneStore {
  call: PhoneCall | null;
  /** Esperando la respuesta del servidor a "Llamar" (para no mandar dos). */
  dialing: string | null;
}

export const usePhoneStore = create<PhoneStore>(() => ({ call: null, dialing: null }));

let room: Room | null = null;

/** Hora del servidor → hora local (el casino ya mide la diferencia al entrar). */
const localTime = (serverMs: number) => serverMs - useCasinoStore.getState().offset;

export function bindPhone(r: Room) {
  room = r;
  usePhoneStore.setState({ call: null, dialing: null });
  r.onMessage(MSG.phoneEvent, handlePhoneEvent);
}

function handlePhoneEvent(e: PhoneEvent) {
  const notify = useOfficeStore.getState().notify;
  const base = e.kind === "failed" || e.kind === "ended" || e.kind === "member" ? null : { callId: e.callId, withUserId: e.withUserId, withName: e.withName };
  switch (e.kind) {
    case "ringing": {
      // En una llamada grupal el aviso se repite cuando cambia quién está: el timbre no vuelve a empezar.
      const again = usePhoneStore.getState().call?.callId === e.callId;
      usePhoneStore.setState({ call: { ...base!, phase: "ringing", from: e.from, since: 0, endsAt: localTime(e.endsAt), members: e.members ?? [] }, dialing: null });
      if (!again) ring.start();
      break;
    }
    case "calling": {
      const again = usePhoneStore.getState().call?.callId === e.callId;
      usePhoneStore.setState({ call: { ...base!, phase: "calling", from: "", since: 0, endsAt: localTime(e.endsAt), members: e.members ?? [] }, dialing: null });
      if (again) break;
      useOfficeStore.getState().closePanel();
      ring.back();
      break;
    }
    case "connected": {
      const was = usePhoneStore.getState().call;
      usePhoneStore.setState({ call: { ...base!, phase: "talking", from: "", since: localTime(e.since), endsAt: 0, members: e.members ?? [] }, dialing: null });
      if (was?.callId !== e.callId || was.phase !== "talking") ring.stop();
      break;
    }
    case "member":
      if (usePhoneStore.getState().call?.callId === e.callId) notify(CALL_MEMBER_TEXT[e.change](e.name), "info");
      break;
    case "ended": {
      const cur = usePhoneStore.getState().call;
      if (cur && cur.callId !== e.callId) break;
      usePhoneStore.setState({ call: null, dialing: null });
      ring.stop();
      ring.hangup();
      const text = callEndText(e);
      if (text) notify(text, e.reason === "left" ? "warning" : "info");
      break;
    }
    case "failed":
      usePhoneStore.setState({ dialing: null });
      ring.busy(e.error === "busy");
      notify(PHONE_ERROR_TEXT[e.error](e.withName), "warning");
      break;
  }
}

/** Llamar a la oficina `zoneId` (el servidor valida el teléfono, ocupado, "No molestar"…). */
export function sendPhoneCall(zoneId: string) {
  dial(zoneId, MSG.phoneCall, { zoneId });
}

/**
 * Marca: `key` identifica el botón que dice "Marcando…" (la oficina o la persona); `type`/`payload` es el
 * mensaje (el del teléfono o el de llamar sin teléfono, ver game/comunicacion.ts).
 */
export function dial(key: string, type: string, payload: unknown) {
  if (!room || usePhoneStore.getState().dialing) return;
  usePhoneStore.setState({ dialing: key });
  room.send(type, payload);
  // Si el servidor no responde (o respondió que no), el botón vuelve.
  setTimeout(() => {
    if (usePhoneStore.getState().dialing === key) usePhoneStore.setState({ dialing: null });
  }, 4000);
}

export function answerPhone(accept: boolean) {
  const call = usePhoneStore.getState().call;
  if (!room || !call || call.phase !== "ringing") return;
  ring.stop();
  room.send(MSG.phoneAnswer, { callId: call.callId, accept });
}

export function hangUpPhone() {
  ring.stop();
  room?.send(MSG.phoneHangup);
}

/** Al salir de la cabaña: nada queda sonando. */
export function resetPhone() {
  ring.stop();
  room = null;
  usePhoneStore.setState({ call: null, dialing: null });
}

// ---------- Timbre ----------

/**
 * Timbre de teléfono de campanilla: dos campanas que el martillo golpea ~20 veces por segundo, en ráfagas
 * de 2 s con 4 s de silencio (como los teléfonos de disco). Suena aunque la pestaña esté en segundo plano
 * (para eso es un timbre), pero respeta el volumen y el silencio de los efectos.
 */
class Ringer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopAt = 0;
  /** Lo que está sonando (para callarlo de golpe al contestar o colgar). */
  private live = new Set<GainNode>();

  private track(g: GainNode, until: number) {
    this.live.add(g);
    setTimeout(() => this.live.delete(g), (until + 0.5) * 1000);
    return g;
  }

  private out(): { ctx: AudioContext; out: AudioNode; vol: number } | null {
    if (!audible("notify")) return null;
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return null;
    const a = sharedAudio("notify");
    if (!a || a.ctx.state !== "running") return null;
    // El timbre sale por la salida de avisos del mezclador (su volumen ya va en la ganancia de esa salida).
    return { ctx: a.ctx, out: mixerBus(a.ctx, "notify"), vol: 0.5 };
  }

  /** Una ráfaga de campanilla de `dur` segundos desde `at`. */
  private burst(a: { ctx: AudioContext; out: AudioNode; vol: number }, at: number, dur: number) {
    const { ctx } = a;
    const env = this.track(ctx.createGain(), dur);
    env.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = "bandpass";
    tone.frequency.value = 1900;
    tone.Q.value = 0.8;
    env.connect(tone).connect(a.out);
    // Cada golpe del martillo: ataque seco y la campana que se apaga rápido (20 golpes por segundo).
    const hits = Math.floor(dur * 20);
    for (let i = 0; i < hits; i++) {
      const t = at + i / 20;
      env.gain.setValueAtTime(a.vol * 0.22, t);
      env.gain.exponentialRampToValueAtTime(a.vol * 0.05, t + 0.045);
    }
    env.gain.setValueAtTime(a.vol * 0.05, at + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.25);
    for (const f of [1320, 1760, 2640]) {
      const osc = ctx.createOscillator();
      osc.type = f === 2640 ? "sine" : "triangle";
      osc.frequency.value = f;
      osc.connect(env);
      osc.start(at);
      osc.stop(at + dur + 0.3);
    }
  }

  /** Suena el teléfono (me llaman): hasta contestar, colgar o que se venza. */
  start() {
    this.stop();
    this.stopAt = Date.now() + 35_000;
    const loop = () => {
      if (Date.now() > this.stopAt) return this.stop();
      const a = this.out();
      if (a) this.burst(a, a.ctx.currentTime + 0.02, 2);
      this.timer = setTimeout(loop, 6000);
    };
    loop();
  }

  /** El tono de "está sonando" para quien llama: tu-u… tu-u… (bajito, 1 s cada 4 s). */
  back() {
    this.stop();
    this.stopAt = Date.now() + 35_000;
    const loop = () => {
      if (Date.now() > this.stopAt) return this.stop();
      const a = this.out();
      if (a) this.tone(a, a.ctx.currentTime + 0.02, 1, [440, 480], 0.05);
      this.timer = setTimeout(loop, 4000);
    };
    loop();
  }

  /** Ocupado (tres pitidos cortos) o el pitido de "no se pudo". */
  busy(busy: boolean) {
    const a = this.out();
    if (!a) return;
    const n = busy ? 3 : 1;
    for (let i = 0; i < n; i++) this.tone(a, a.ctx.currentTime + 0.02 + i * 0.5, 0.25, [480, 620], 0.05);
  }

  /** El clic de colgar el auricular en la horquilla. */
  hangup() {
    const a = this.out();
    if (!a) return;
    this.tone(a, a.ctx.currentTime + 0.01, 0.05, [220], 0.12);
    this.tone(a, a.ctx.currentTime + 0.07, 0.04, [160], 0.1);
  }

  private tone(a: { ctx: AudioContext; out: AudioNode; vol: number }, at: number, dur: number, freqs: number[], vol: number) {
    const g = this.track(a.ctx.createGain(), at - a.ctx.currentTime + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(a.vol * vol * 2, at + 0.01);
    g.gain.setValueAtTime(a.vol * vol * 2, at + dur - 0.02);
    g.gain.linearRampToValueAtTime(0, at + dur);
    g.connect(a.out);
    for (const f of freqs) {
      const osc = a.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(g);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    }
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const g of this.live) {
      const now = g.context.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(0, now);
    }
    this.live.clear();
  }
}

const ring = new Ringer();
