import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  /** User.id (Auth.js). */
  @type("string") userId = "";
  @type("string") name = "";
  @type("string") avatar = "ada";
  /** Posición de los pies, en px. */
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") dir = "down";
  @type("boolean") moving = false;
  @type("string") status = "available";
  /** Zona actual ("" = pasillo sin zona). */
  @type("string") zoneId = "";
}

export class OfficeInfo extends Schema {
  @type("string") zoneId = "";
  @type("string") name = "";
  /** User.id del dueño ("" = sin asignar: cualquiera puede entrar y nadie la puede cerrar). */
  @type("string") ownerId = "";
  @type("string") ownerName = "";
  @type("boolean") locked = false;
  /** User.id de quienes el dueño dejó pasar (se pierde al salir de la oficina). */
  @type(["string"]) guests = new ArraySchema<string>();
}

export class OfficeState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: OfficeInfo }) offices = new MapSchema<OfficeInfo>();
}
