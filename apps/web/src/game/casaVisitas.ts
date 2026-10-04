// Las visitas a la casa de cada persona (VIR-81/82) en el navegador: lo que el servidor dice de cada casa
// (`state.casas`: el modo y a quiénes dejó pasar), los avisos y lo que manda el dueño (cambiar el modo,
// pedirle a alguien que se vaya). Las reglas están en casa-propia.ts de @hyvento/shared y las decide el
// servidor; aquí solo se anticipan para los botones.
import {
  BUS_MSG,
  CASA_FIESTA_MSG,
  CASA_PROPIA_MSG,
  casaPropiaBlock,
  casaAreaOf,
  isCasaModo,
  type CasaModo,
  type OfficeRadioMessage,
  type OfficeRadioState,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { create } from "zustand";
import type { OfficeRoom } from "./network";

export interface CasaView {
  ownerId: string;
  ownerName: string;
  modo: CasaModo;
  guests: string[];
  /** Modo fiesta (casa-fiesta.ts): abierta, con luces y aviso en el chat. */
  fiesta: boolean;
  /** La música del equipo de sonido (como la radio de una oficina), o null si está apagada. */
  radio: OfficeRadioState | null;
}

interface CasasStore {
  casas: Record<string, CasaView>;
  /** Eligiendo a qué casa ir en la estación (E con casas a las que se puede entrar). */
  choosing: boolean;
  setChoosing: (on: boolean) => void;
}

export const useCasasStore = create<CasasStore>((set) => ({
  casas: {},
  choosing: false,
  setChoosing: (choosing) => set({ choosing }),
}));

let room: OfficeRoom | null = null;

/** Engancha `state.casas` de la sala (se llama al conectar). */
export function bindCasas(r: OfficeRoom) {
  room = r;
  useCasasStore.setState({ casas: {}, choosing: false });
  const $ = getStateCallbacks(r);
  $(r.state).casas.onAdd((casa, ownerId) => {
    const push = () => {
      if (room !== r) return;
      const view: CasaView = {
        ownerId,
        ownerName: casa.ownerName,
        modo: isCasaModo(casa.modo) ? casa.modo : "invitados",
        guests: [...casa.guests],
        fiesta: casa.fiesta,
        radio: casa.radioVideo
          ? {
              videoId: casa.radioVideo,
              title: casa.radioTitle,
              startedAt: casa.radioStartedAt,
              paused: casa.radioPaused,
              pausedAt: casa.radioPausedAt,
              durationMs: casa.radioDurationMs,
            }
          : null,
      };
      useCasasStore.setState((s) => ({ casas: { ...s.casas, [ownerId]: view } }));
    };
    push();
    const c$ = $(casa);
    c$.onChange(push);
    c$.guests.onAdd(push);
    c$.guests.onRemove(push);
  });
  $(r.state).casas.onRemove((_casa, ownerId) => {
    if (room !== r) return;
    useCasasStore.setState((s) => {
      const casas = { ...s.casas };
      delete casas[ownerId];
      return { casas };
    });
  });
}

/** El dueño cambia quién entra a su casa. */
export function sendCasaModo(modo: CasaModo) {
  room?.send(CASA_PROPIA_MSG.modo, { modo });
}

/** El dueño prende o apaga el modo fiesta. */
export function sendCasaFiesta(on: boolean) {
  room?.send(CASA_FIESTA_MSG.fiesta, { on });
}

/** La música de la casa (el dueño la maneja; la duración la informa cualquiera que la oiga). */
export function sendCasaRadio(msg: OfficeRadioMessage) {
  room?.send(CASA_FIESTA_MSG.radio, msg);
}

/** El dueño le pide a alguien que se vaya de su casa. */
export function sendCasaKick(userId: string) {
  room?.send(CASA_PROPIA_MSG.kick, { userId });
}

/** Subirse al Megabús en la estación con destino la casa de `ownerId` (sin él, la propia). */
export function boardBusTo(ownerId?: string) {
  useCasasStore.getState().setChoosing(false);
  room?.send(BUS_MSG.board, ownerId ? { to: ownerId } : {});
}

/** Las casas ajenas a las que puedo entrar ahora (abiertas o que me dejaron pasar), para elegir en el bus. */
export function casasAbiertasPara(me: string | null): CasaView[] {
  if (!me) return [];
  return Object.values(useCasasStore.getState().casas)
    .filter((c) => c.ownerId !== me && !casaPropiaBlock(casaAreaOf(c.ownerId), me, c))
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName));
}
