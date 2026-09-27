import { describe, expect, it } from "vitest";
import {
  PHOTO,
  canManagePhoto,
  checkPhotoFile,
  cleanCaption,
  inPhotoFrame,
  peopleInFrame,
  peopleText,
  photoDateText,
  photoDayStart,
  signPhotoTicket,
  sniffPhoto,
  verifyPhotoTicket,
  type PhotoTicketClaims,
} from "./photos";

const SECRET = "s".repeat(40);

/** Cabecera mínima de un PNG de w x h (firma + IHDR). */
function pngHeader(w: number, h: number, extra = 0) {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}

/** Cabecera de un WebP sin pérdida (VP8L) de w x h. */
function webpLossless(w: number, h: number) {
  const b = new Uint8Array(40);
  b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  b.set([..."WEBPVP8L"].map((c) => c.charCodeAt(0)), 8);
  b[20] = 0x2f;
  const bits = (w - 1) | ((h - 1) << 14);
  new DataView(b.buffer).setUint32(21, bits, true);
  return b;
}

/** Cabecera de un WebP extendido (VP8X) de w x h. */
function webpExtended(w: number, h: number) {
  const b = new Uint8Array(40);
  b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  b.set([..."WEBPVP8X"].map((c) => c.charCodeAt(0)), 8);
  const put24 = (at: number, v: number) => b.set([v & 255, (v >> 8) & 255, (v >> 16) & 255], at);
  put24(24, w - 1);
  put24(27, h - 1);
  return b;
}

describe("encuadre de la foto", () => {
  const me = { x: 500, y: 500 };

  it("sale quien está al lado y no quien está lejos", () => {
    expect(inPhotoFrame(me, { x: 540, y: 500 })).toBe(true);
    expect(inPhotoFrame(me, { x: 500, y: 560 })).toBe(true);
    expect(inPhotoFrame(me, { x: 1400, y: 500 })).toBe(false);
    expect(inPhotoFrame(me, { x: 500, y: 1400 })).toBe(false);
  });

  it("se mide en la pantalla isométrica, no en el piso", () => {
    // +x y -y a la vez = a la derecha en pantalla; +x y +y = hacia abajo, donde el encuadre llega menos.
    expect(inPhotoFrame(me, { x: 500 + 140, y: 500 - 140 })).toBe(true);
    expect(inPhotoFrame(me, { x: 500 + 190, y: 500 - 190 })).toBe(false);
    expect(inPhotoFrame(me, { x: 500 + 140, y: 500 + 140 })).toBe(true);
    expect(inPhotoFrame(me, { x: 500 + 190, y: 500 + 190 })).toBe(false);
  });

  it("quien la saca va primero, luego por cercanía y sin repetir", () => {
    const p = (id: string, x: number, y: number) => ({ id, name: id.toUpperCase(), x, y });
    const shooter = p("ana", 500, 500);
    const people = peopleInFrame(shooter, [p("lejos", 2000, 2000), p("carla", 580, 500), p("bruno", 530, 500), shooter]);
    expect(people.map((x) => x.id)).toEqual(["ana", "bruno", "carla"]);
    expect(people[1]).toEqual({ id: "bruno", name: "BRUNO" });
  });

  it("no nombra a más de maxPeople", () => {
    const shooter = { id: "a", name: "A", x: 500, y: 500 };
    const crowd = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, x: 500 + (i % 5) * 4, y: 500 + i }));
    expect(peopleInFrame(shooter, crowd)).toHaveLength(PHOTO.maxPeople);
  });
});

describe("ticket de la foto", () => {
  const claims: PhotoTicketClaims = {
    sub: "u-ana",
    jti: "foto-1",
    area: "planta-baja",
    people: [{ id: "u-ana", name: "Ana" }],
    takenAt: 1_790_000_000_000,
  };

  it("firma y verifica", async () => {
    const t = await signPhotoTicket(claims, SECRET);
    await expect(verifyPhotoTicket(t, SECRET)).resolves.toEqual(claims);
  });

  it("rechaza otro secreto y el vencido", async () => {
    await expect(verifyPhotoTicket(await signPhotoTicket(claims, "x".repeat(40)), SECRET)).rejects.toThrow();
    await expect(verifyPhotoTicket(await signPhotoTicket(claims, SECRET, "-1s"), SECRET)).rejects.toThrow();
  });
});

describe("archivo de la foto", () => {
  it("reconoce PNG y WebP por sus bytes, con su tamaño", () => {
    expect(sniffPhoto(pngHeader(336, 248))).toEqual({ mime: "image/png", width: 336, height: 248 });
    expect(sniffPhoto(webpLossless(672, 496))).toEqual({ mime: "image/webp", width: 672, height: 496 });
    expect(sniffPhoto(webpExtended(336, 248))).toEqual({ mime: "image/webp", width: 336, height: 248 });
    expect(sniffPhoto(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)]))).toBeNull(); // JPEG
  });

  it("rechaza lo pesado, lo enorme y lo que no es imagen", () => {
    expect(checkPhotoFile(pngHeader(336, 248))).toEqual({ ok: true, mime: "image/png" });
    expect(checkPhotoFile(pngHeader(336, 248, PHOTO.maxBytes))).toEqual({ ok: false, error: "size" });
    expect(checkPhotoFile(pngHeader(4000, 248))).toEqual({ ok: false, error: "size" });
    expect(checkPhotoFile(pngHeader(0, 248))).toEqual({ ok: false, error: "size" });
    expect(checkPhotoFile(new Uint8Array(50))).toEqual({ ok: false, error: "type" });
  });

  it("limpia el pie de foto y no deja uno largo", () => {
    expect(cleanCaption("  Hola \n equipo  ")).toBe("Hola equipo");
    expect(cleanCaption(undefined)).toBe("");
    expect(cleanCaption("a".repeat(PHOTO.captionMax + 1))).toBeNull();
  });
});

describe("permisos y textos", () => {
  it("borra quien la sacó o un admin", () => {
    const photo = { takenById: "u-ana" };
    expect(canManagePhoto(photo, { id: "u-ana", role: "MEMBER" })).toBe(true);
    expect(canManagePhoto(photo, { id: "u-bruno", role: "MEMBER" })).toBe(false);
    expect(canManagePhoto(photo, { id: "u-bruno", role: "ADMIN" })).toBe(true);
  });

  it("el día empieza a medianoche de Bogotá", () => {
    // 2026-09-27 03:00 UTC = 26 sep 22:00 en Bogotá: el día empezó el 26 a las 05:00 UTC.
    expect(photoDayStart(Date.UTC(2026, 8, 27, 3)).toISOString()).toBe("2026-09-26T05:00:00.000Z");
  });

  it("fecha y nombres del pie", () => {
    expect(photoDateText(Date.UTC(2026, 8, 27, 20, 5))).toBe("27 sep 2026 · 3:05 p. m.");
    expect(peopleText([{ name: "Ana" }])).toBe("Ana");
    expect(peopleText([{ name: "Ana" }, { name: "Bruno" }, { name: "Carla" }])).toBe("Ana, Bruno y Carla");
    expect(peopleText(["A", "B", "C", "D", "E", "F"].map((name) => ({ name })))).toBe("A, B, C y 3 más");
  });
});
