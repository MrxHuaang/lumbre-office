// Rechazos que antes eran mudos: el servidor dice por qué no y el cliente pone el texto.

export const RECHAZO_MSG = {
  /** Servidor → quien lo intentó: por qué no se hizo (`RechazoNotice`). */
  notice: "rechazo:notice",
} as const;

export type RechazoCode = "rate" | "far" | "cooldown" | "seatTaken";

export interface RechazoNotice {
  code: RechazoCode;
}

export const RECHAZO_TEXT: Record<RechazoCode, string> = {
  rate: "Vas muy rápido: espera unos segundos para escribir otra vez.",
  far: "Estás muy lejos: acércate un poco.",
  cooldown: "Espera un momento antes de volver a usarlo.",
  seatTaken: "Esa silla ya la ocupó otra persona.",
};
