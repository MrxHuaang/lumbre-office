// Colores del Megabús (los de la foto del dueño): verde lima de punta a punta con sombras verdes, vidrios
// casi negros, el fuelle gris con pliegues, faldón y parachoques negros y rines grises. Los usan el bus de
// la calle, la estación y el bus por dentro.
import { ramp } from "./pixel";

/** Verde lima de la carrocería (de la sombra más honda al brillo). */
export const LIME = ramp("#2c4f17", "#43711f", "#62982a", "#7fb835", "#8dc63f", "#9bd14a", "#c2e57e");
/** Vidrio polarizado casi negro. */
export const TINT = ramp("#0d110f", "#151b18", "#1e2622", "#2b3530", "#3d4a44");
/** Caucho y plástico negros (faldón, parachoques, llantas, el piso del bus). */
export const BLACK = ramp("#121212", "#1c1c1b", "#272726", "#343432", "#454542");
/** Gris del fuelle y de los rines (tibio, no azulado). */
export const GREY = ramp("#3e3d3a", "#56544f", "#6f6c66", "#8b8881", "#aaa79f", "#cfccc4");
/** Amarillo de los pasamanos y las barras. */
export const HANDRAIL = ramp("#7a5a08", "#b8870f", "#e0b21c", "#f5cf3d", "#fde483");
/** Letreros de ruta: ámbar de LED. */
export const LED = ramp("#3a1e02", "#8a4b05", "#e08a0c", "#ffb42a", "#ffd97a");
