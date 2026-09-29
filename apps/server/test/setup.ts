// Antes de cada archivo de tests: la mochila empieza con lo que cada test pone (sin el celular gratis de
// al entrar, que cambiaría las casillas que esperan). test/celular.test.ts lo prende para probarlo.
import { OfficeRoom } from "../src/rooms/OfficeRoom";

OfficeRoom.celularAlEntrar = false;
