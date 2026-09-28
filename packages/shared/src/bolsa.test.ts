import { describe, expect, it } from "vitest";
import {
  arrangeBag,
  BAG,
  BAG_KEYS,
  BAG_OBJECTS,
  BagDropMessage,
  BagMoveMessage,
  BagSelectMessage,
  bagItemInfo,
  bagItemsOf,
  handParts,
  nameFromId,
  nextBagRow,
  objIdOf,
  objItemId,
} from "./bolsa";
import { BAR_MENU, CAFE_MENU, CINEMA_MENU, heldParts } from "./cafe";
import { FREE_NAMES } from "./casa";
import { CONSUMABLES } from "./consumables";
import { CROPS, EMPTY_CAN, HONEY, WATERING_CAN, seedsOf } from "./huerto";
import { SHOP_FURNITURE } from "./shop";

describe("mochila: el registro de objetos", () => {
  it("todo lo que queda en la mano por una carta tiene nombre y se lleva solo (una casilla por cosa)", () => {
    for (const item of [...CAFE_MENU, ...BAR_MENU, ...CINEMA_MENU])
      for (const art of item.holds) {
        expect(BAG_OBJECTS[art]?.name, art).toBeTruthy();
        // Lo que está en la mano es siempre una sola cosa: su id vuelve a dar esa cosa.
        expect(heldParts(art), art).toEqual([art]);
      }
    expect(bagItemsOf("onces")).toEqual(["obj:tinto", "obj:pandebono"]);
    expect(bagItemsOf("gaseosa-cine")).toEqual(["obj:coca-cola"]);
    expect(bagItemsOf("no-existe")).toEqual([]);
  });

  it("lo gratis de la casa, lo cosechado, las semillas y la regadera también están", () => {
    for (const id of Object.keys(FREE_NAMES)) if (id !== EMPTY_CAN) expect(BAG_OBJECTS[id], id).toBeDefined();
    for (const c of CROPS) {
      expect(bagItemInfo(objItemId(c.product)).name).toBe(c.productName);
      expect(bagItemInfo(objItemId(seedsOf(c.id)))).toMatchObject({ kind: "semillas", use: "tool", max: 10 });
    }
    // La regadera vacía es la misma regadera sin agua: no es otra cosa de la mochila.
    expect(BAG_OBJECTS[EMPTY_CAN]).toBeUndefined();
    expect(bagItemInfo(objItemId(WATERING_CAN))).toMatchObject({ name: "Regadera", max: 1, durable: true, use: "tool" });
    expect(bagItemInfo(objItemId(HONEY)).use).toBe("consume");
  });

  it("lo que se come o se toma se usa con F; lo que no está en CONSUMABLES solo se lleva", () => {
    for (const id of Object.keys(BAG_OBJECTS)) {
      const info = bagItemInfo(objItemId(id));
      if (info.use === "consume") expect(CONSUMABLES[id], id).toBeDefined();
    }
    expect(bagItemInfo("obj:tinto")).toMatchObject({ furniture: false, art: "tinto", kind: "bebida", use: "consume", max: BAG.stackMax });
    expect(bagItemInfo("obj:huevo-criollo")).toMatchObject({ name: "Huevo criollo", kind: "objeto", use: null, max: BAG.stackMax });
  });

  it("los muebles salen de la tienda (y uno desconocido no rompe)", () => {
    for (const f of SHOP_FURNITURE) expect(bagItemInfo(f.id)).toMatchObject({ name: f.name, furniture: true, kind: "mueble", use: null, art: f.id });
    expect(bagItemInfo("mesa-vieja")).toMatchObject({ name: "Mesa vieja", furniture: true });
    expect(nameFromId("")).toBe("Objeto");
  });

  it("ids: el prefijo de los objetos y lo que se ve en la mano", () => {
    expect(objIdOf("obj:fresa")).toBe("fresa");
    expect(objIdOf("plant")).toBeNull();
    expect(handParts("tinto")).toEqual(["tinto"]);
    expect(handParts("huevo")).toEqual(["huevo"]);
    expect(handParts("")).toEqual([]);
  });
});

describe("mochila: las casillas", () => {
  const stack = (itemId: string, quantity = 1) => ({ itemId, quantity });

  it("cada cosa va a su casilla guardada; lo nuevo, a la primera libre", () => {
    const r = arrangeBag([stack("obj:tinto", 2), stack("plant"), stack("obj:fresa", 5)], { "obj:tinto": 7, plant: 0 });
    expect(r.slots).toHaveLength(BAG.slots);
    expect(r.slots[7]).toEqual(stack("obj:tinto", 2));
    expect(r.slots[0]).toEqual(stack("plant"));
    expect(r.slots[1]).toEqual(stack("obj:fresa", 5));
    expect(r.assigned).toEqual({ "obj:fresa": 1 });
    expect(r.overflow).toEqual([]);
  });

  it("dos cosas en la misma casilla, una casilla inválida o lo que ya no se tiene no rompen nada", () => {
    const r = arrangeBag([stack("a"), stack("b"), stack("c"), stack("d", 0)], { a: 3, b: 3, c: 99, d: 0 });
    expect(r.slots[3]).toEqual(stack("a"));
    expect(r.slots[0]).toEqual(stack("b"));
    expect(r.slots[1]).toEqual(stack("c"));
    expect(r.assigned).toEqual({ b: 0, c: 1 });
  });

  it("lo que no cabe queda aparte, sin perderse", () => {
    const many = Array.from({ length: BAG.slots + 2 }, (_, i) => stack(`m${i}`));
    const r = arrangeBag(many, {});
    expect(r.slots.every(Boolean)).toBe(true);
    expect(r.overflow.map((s) => s.itemId)).toEqual([`m${BAG.slots}`, `m${BAG.slots + 1}`]);
  });

  it("Tab pasa a la misma columna de la fila siguiente (y vuelve a la primera)", () => {
    expect(nextBagRow(3)).toBe(15);
    expect(nextBagRow(15)).toBe(27);
    expect(nextBagRow(27)).toBe(3);
    expect(nextBagRow(3, -1)).toBe(27);
    expect(BAG_KEYS).toHaveLength(BAG.cols);
  });

  it("los mensajes validan casillas e ids", () => {
    expect(BagSelectMessage.safeParse({ slot: 35 }).success).toBe(true);
    expect(BagSelectMessage.safeParse({ slot: 36 }).success).toBe(false);
    expect(BagMoveMessage.safeParse({ itemId: "obj:tinto", to: 0 }).success).toBe(true);
    expect(BagMoveMessage.safeParse({ itemId: "Obj Tinto", to: 0 }).success).toBe(false);
    expect(BagDropMessage.safeParse({ itemId: "obj:tinto", quantity: 0 }).success).toBe(false);
  });
});
