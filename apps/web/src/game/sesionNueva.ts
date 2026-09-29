import { useOfficeStore } from "./store";

/**
 * Se entró de nuevo con sesión nueva (tras un reinicio del servidor): el sessionId cambia y la sala vieja
 * ya no existe. Lo que colgaba de ella se olvida antes de enganchar la nueva; si no, el propio jugador de
 * la sesión vieja queda en la lista de conectados como un fantasma (nadie avisa que se fue). Una
 * reconexión con el mismo sessionId no lo necesita: el servidor manda el estado y lo pisa.
 * Lo que es del navegador (chat, noche, nombres, preferencias) se conserva.
 */
export function forgetOldSession() {
  useOfficeStore.setState({
    sessionId: null,
    players: {},
    offices: {},
    zone: null,
    // Se aparece de pie en el jardín: nada de lo que había alrededor sigue al alcance.
    walkTarget: null,
    doorPrompt: null,
    seatPrompt: null,
    atComputer: false,
    atSwivel: false,
    seatSun: false,
    seatSpa: null,
    atPhone: false,
    toastPrompt: null,
    interact: null,
    usable: null,
    panel: null,
    // Toques, invitaciones y el editor de la casa eran de la sala vieja (el servidor nuevo no los conoce).
    pendingKnock: null,
    knockRequests: [],
    invitations: [],
    decorating: false,
    worldEditing: false,
    decorPick: null,
  });
}
