import { beforeEach, describe, expect, it } from "vitest";
import { deletePhotoAs, listPhotosFor, photoImageFor, pinPhotoAs, uploadPhoto, type NewPhotoRecord, type PhotoRecord, type PhotoStore } from "./photo-service";
import { PHOTO, signPhotoTicket, type PhotoTicketClaims } from "./photos";

const SECRET = "s".repeat(40);
const NOW = Date.UTC(2026, 8, 27, 18); // 1 p. m. en Bogotá
const ana = { id: "u-ana", role: "MEMBER" };
const bruno = { id: "u-bruno", role: "MEMBER" };
const admin = { id: "u-admin", role: "ADMIN" };
const NAMES: Record<string, string> = { "u-ana": "Ana", "u-bruno": "Bruno", "u-admin": "Admin" };

/** El mismo contrato que el almacén de Prisma (packages/db/src/photos.ts), en memoria. */
class MemoryPhotoStore implements PhotoStore {
  rows: (PhotoRecord & { image: Uint8Array; mime: string })[] = [];
  clock = NOW;

  async save(p: NewPhotoRecord, rules: { dailyLimit: number; since: Date; keep: number; keepPinned: number }) {
    if (this.rows.some((r) => r.id === p.id)) return "duplicate" as const;
    const today = this.rows.filter((r) => r.takenById === p.takenById && r.createdAt >= rules.since).length;
    if (today >= rules.dailyLimit) return "limit" as const;
    this.rows.unshift({ ...p, takenByName: NAMES[p.takenById] ?? "?", pinned: true, createdAt: new Date(this.clock++) });
    const pinned = this.rows.filter((r) => r.pinned).slice(0, rules.keepPinned);
    const loose = this.rows.filter((r) => !r.pinned).slice(0, rules.keep);
    this.rows = this.rows.filter((r) => pinned.includes(r) || loose.includes(r));
    return "ok" as const;
  }
  async list(limit: number) {
    return this.rows.slice(0, limit);
  }
  async find(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async image(id: string) {
    const r = this.rows.find((x) => x.id === id);
    return r ? { image: r.image, mime: r.mime } : null;
  }
  async remove(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return this.rows.length < before;
  }
  async setPinned(id: string, pinned: boolean) {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.pinned = pinned;
    return Boolean(r);
  }
}

/** Un PNG válido de 336 x 248 (la cabecera basta: el tipo se mira por los bytes). */
function png(extra = 64) {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, 336);
  new DataView(b.buffer).setUint32(20, 248);
  return b;
}

let n = 0;
const ticket = (over: Partial<PhotoTicketClaims> = {}, ttl?: string) =>
  signPhotoTicket(
    { sub: ana.id, jti: `foto-${++n}`, area: "planta-baja", people: [{ id: ana.id, name: "Ana" }, { id: bruno.id, name: "Bruno" }], takenAt: NOW, ...over },
    SECRET,
    ttl,
  );

let store: MemoryPhotoStore;
const deps = () => ({ store, secret: SECRET, now: NOW });

beforeEach(() => {
  store = new MemoryPhotoStore();
});

describe("subir una foto", () => {
  it("guarda la foto con el nivel y la gente del ticket (no los del cliente)", async () => {
    const res = await uploadPhoto(deps(), ana, { ticket: await ticket(), caption: "  El equipo  ", image: png() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({ area: "planta-baja", caption: "El equipo", mine: true, canManage: true, pinned: true });
    expect(res.value.people.map((p) => p.name)).toEqual(["Ana", "Bruno"]);
    expect(store.rows[0]!.mime).toBe("image/png");
  });

  it("pide sesión, un ticket vigente y que sea de quien la sube", async () => {
    expect(await uploadPhoto(deps(), null, { ticket: await ticket(), caption: "", image: png() })).toEqual({ ok: false, error: "auth" });
    expect(await uploadPhoto(deps(), ana, { ticket: "basura", caption: "", image: png() })).toEqual({ ok: false, error: "ticket" });
    expect(await uploadPhoto(deps(), ana, { ticket: undefined, caption: "", image: png() })).toEqual({ ok: false, error: "ticket" });
    expect(await uploadPhoto(deps(), ana, { ticket: await ticket({}, "-1s"), caption: "", image: png() })).toEqual({ ok: false, error: "ticket" });
    const otro = await signPhotoTicket({ sub: ana.id, jti: "x", area: "jardin", people: [], takenAt: NOW }, "o".repeat(40));
    expect(await uploadPhoto(deps(), ana, { ticket: otro, caption: "", image: png() })).toEqual({ ok: false, error: "ticket" });
    expect(await uploadPhoto(deps(), bruno, { ticket: await ticket(), caption: "", image: png() })).toEqual({ ok: false, error: "not-yours" });
    expect(store.rows).toHaveLength(0);
  });

  it("rechaza lo que no es PNG/WebP, lo pesado y un pie largo", async () => {
    const t = await ticket();
    expect(await uploadPhoto(deps(), ana, { ticket: t, caption: "", image: new TextEncoder().encode("<svg/>".padEnd(40)) })).toEqual({ ok: false, error: "type" });
    expect(await uploadPhoto(deps(), ana, { ticket: t, caption: "", image: null })).toEqual({ ok: false, error: "type" });
    expect(await uploadPhoto(deps(), ana, { ticket: t, caption: "", image: png(PHOTO.maxBytes) })).toEqual({ ok: false, error: "size" });
    expect(await uploadPhoto(deps(), ana, { ticket: t, caption: "x".repeat(PHOTO.captionMax + 1), image: png() })).toEqual({ ok: false, error: "caption" });
    expect(store.rows).toHaveLength(0);
  });

  it("la misma foto no se sube dos veces", async () => {
    const t = await ticket();
    expect((await uploadPhoto(deps(), ana, { ticket: t, caption: "", image: png() })).ok).toBe(true);
    expect(await uploadPhoto(deps(), ana, { ticket: t, caption: "", image: png() })).toEqual({ ok: false, error: "duplicate" });
  });

  it(`hasta ${PHOTO.dailyLimit} fotos por persona por día; otra persona sigue pudiendo`, async () => {
    for (let i = 0; i < PHOTO.dailyLimit; i++) expect((await uploadPhoto(deps(), ana, { ticket: await ticket(), caption: "", image: png() })).ok).toBe(true);
    expect(await uploadPhoto(deps(), ana, { ticket: await ticket(), caption: "", image: png() })).toEqual({ ok: false, error: "limit" });
    expect((await uploadPhoto(deps(), bruno, { ticket: await ticket({ sub: bruno.id }), caption: "", image: png() })).ok).toBe(true);
    // Al otro día (de Bogotá) vuelve a poder.
    const tomorrow = { ...deps(), now: NOW + 24 * 3_600_000 };
    store.clock = tomorrow.now;
    expect((await uploadPhoto(tomorrow, ana, { ticket: await ticket(), caption: "", image: png() })).ok).toBe(true);
  });
});

describe("ver y borrar", () => {
  it("la lista y la imagen piden sesión; cada foto dice si es tuya y si la puedes borrar", async () => {
    await uploadPhoto(deps(), ana, { ticket: await ticket(), caption: "", image: png() });
    expect(await listPhotosFor(store, null)).toEqual({ ok: false, error: "auth" });
    const asBruno = await listPhotosFor(store, bruno);
    expect(asBruno.ok && asBruno.value[0]).toMatchObject({ mine: false, canManage: false });
    const asAdmin = await listPhotosFor(store, admin);
    expect(asAdmin.ok && asAdmin.value[0]).toMatchObject({ mine: false, canManage: true });
    const id = store.rows[0]!.id;
    expect(await photoImageFor(store, null, id)).toEqual({ ok: false, error: "auth" });
    const img = await photoImageFor(store, bruno, id);
    expect(img.ok && img.value.mime).toBe("image/png");
    expect(await photoImageFor(store, bruno, "no-existe")).toEqual({ ok: false, error: "not-found" });
  });

  it("borra quien la sacó o un admin, nadie más", async () => {
    await uploadPhoto(deps(), ana, { ticket: await ticket(), caption: "", image: png() });
    await uploadPhoto(deps(), ana, { ticket: await ticket(), caption: "", image: png() });
    const [a, b] = store.rows.map((r) => r.id);
    expect(await deletePhotoAs(store, bruno, a!)).toEqual({ ok: false, error: "forbidden" });
    expect(await deletePhotoAs(store, ana, a!)).toEqual({ ok: true, value: null });
    expect(await deletePhotoAs(store, admin, b!)).toEqual({ ok: true, value: null });
    expect(await deletePhotoAs(store, admin, b!)).toEqual({ ok: false, error: "not-found" });
    expect(store.rows).toHaveLength(0);
  });

  it("sacar del corcho: la misma regla, y sigue en la galería", async () => {
    await uploadPhoto(deps(), ana, { ticket: await ticket(), caption: "", image: png() });
    const id = store.rows[0]!.id;
    expect(await pinPhotoAs(store, bruno, id, false)).toEqual({ ok: false, error: "forbidden" });
    const res = await pinPhotoAs(store, ana, id, false);
    expect(res.ok && res.value.pinned).toBe(false);
    const list = await listPhotosFor(store, ana);
    expect(list.ok && list.value).toHaveLength(1);
  });

  it(`solo se guardan las últimas ${PHOTO.keep} sin fijar y las últimas ${PHOTO.keepPinned} fijadas`, async () => {
    const upload = async (i: number) => {
      const p = { id: `u-${i}`, role: "MEMBER" };
      await uploadPhoto(deps(), p, { ticket: await ticket({ sub: p.id }), caption: "", image: png() });
    };
    for (let i = 0; i < PHOTO.keepPinned + 5; i++) await upload(i);
    expect(store.rows).toHaveLength(PHOTO.keepPinned);
    expect(store.rows[0]!.takenById).toBe(`u-${PHOTO.keepPinned + 4}`);

    // Las sin fijar tienen su propio tope y no sacan del corcho a las fijadas.
    for (const r of store.rows) r.pinned = false;
    store.rows[store.rows.length - 1]!.pinned = true;
    const oldestPinned = store.rows.at(-1)!.id;
    await upload(999);
    store.rows[0]!.pinned = false;
    await upload(1000);
    expect(store.rows.filter((r) => !r.pinned)).toHaveLength(PHOTO.keep);
    expect(store.rows.some((r) => r.id === oldestPinned)).toBe(true);
  });
});
