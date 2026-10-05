// Antes de cada archivo de tests: la mochila empieza con lo que cada test pone (sin el celular gratis de
// al entrar, que cambiaría las casillas que esperan). test/celular.test.ts lo prende para probarlo.
import { OfficeRoom } from "../src/rooms/OfficeRoom";

OfficeRoom.celularAlEntrar = false;
// Ni la canasta de la Noche de brujas (el reloj real puede caer en el festival). test/noche-brujas.test.ts la prende.
OfficeRoom.brujasCanasta = false;
// Sin límite de mensajes: los helpers caminan mandando ráfagas de pasos. test/limite-mensajes.test.ts lo prende.
OfficeRoom.msgRate = null;
