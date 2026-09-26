import { MapSchema, Schema, type } from "@colyseus/schema";

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

export class OfficeState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
