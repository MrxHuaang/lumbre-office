import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prefs", () => ({ lessMotion: () => true }));

import { CAMARA_COMPARSA_MIN, CamaraComparsa, zoomComparsa } from "./camara";

function escena(zoom: number) {
  const cam = {
    zoom,
    zoomEffect: { isRunning: false },
    setZoom(z: number) {
      cam.zoom = z;
    },
    zoomTo(z: number) {
      cam.zoom = z;
    },
  };
  return { scene: { cameras: { main: cam } } as never, cam };
}

describe("la cámara de la comparsa", () => {
  it("se acerca un paso con 3 o más de la cabaña bailando, sin pasarse del máximo", () => {
    expect(CAMARA_COMPARSA_MIN).toBe(3);
    expect(zoomComparsa(2, 2, 5)).toBe(2);
    expect(zoomComparsa(2, 3, 5)).toBe(3);
    expect(zoomComparsa(5, 8, 5)).toBe(5);
  });

  it("vuelve a donde estaba al salirse o si quedan menos de 3", () => {
    const { scene, cam } = escena(2);
    const c = new CamaraComparsa(scene, 5);
    c.update(true, 2);
    expect(cam.zoom).toBe(2);
    c.update(true, 3);
    expect(cam.zoom).toBe(3);
    c.update(true, 4);
    expect(cam.zoom).toBe(3);
    c.update(true, 2);
    expect(cam.zoom).toBe(2);
    c.update(true, 3);
    c.update(false, 3);
    expect(cam.zoom).toBe(2);
  });

  it("si alguien movió el zoom mientras bailaba, no se lo deshace", () => {
    const { scene, cam } = escena(2);
    const c = new CamaraComparsa(scene, 5);
    c.update(true, 3);
    cam.zoom = 4;
    c.update(false, 0);
    expect(cam.zoom).toBe(4);
  });
});
