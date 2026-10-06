import { describe, expect, it } from "vitest";
import { isPermiso, PERMISO_IDS, PERMISOS, PermisoId, permisosEfectivos, puede, SetPermisoBody } from "./permisos";

describe("catálogo de permisos", () => {
  it("ids únicos, estables y en kebab-case, con nombre y descripción en español", () => {
    expect(new Set(PERMISO_IDS).size).toBe(PERMISO_IDS.length);
    for (const p of PERMISOS) {
      expect(p.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(p.nombre.length).toBeGreaterThan(0);
      expect(p.descripcion.length).toBeGreaterThan(0);
    }
    // Se guardan en la base: cambiar uno deja huérfanos los permisos ya dados.
    expect(PERMISO_IDS).toEqual(expect.arrayContaining(["anunciar", "editar-casa", "director"]));
  });

  it("isPermiso y el esquema solo aceptan ids del catálogo", () => {
    expect(isPermiso("anunciar")).toBe(true);
    expect(isPermiso("reloj")).toBe(false);
    expect(isPermiso(3)).toBe(false);
    expect(PermisoId.safeParse("borrar-todo").success).toBe(false);
    expect(SetPermisoBody.safeParse({ userId: "u1", permiso: "editar-casa", on: true }).success).toBe(true);
    expect(SetPermisoBody.safeParse({ userId: "", permiso: "editar-casa", on: true }).success).toBe(false);
  });
});

describe("permisos efectivos", () => {
  it("un admin tiene todos", () => {
    expect(permisosEfectivos({ admin: true, granted: [], everyone: [] })).toEqual([...PERMISO_IDS]);
  });

  it("sin nada no puede nada", () => {
    expect(permisosEfectivos({ admin: false, granted: [], everyone: [] })).toEqual([]);
  });

  it("junta lo dado y lo abierto a todos, sin repetir, en el orden del catálogo e ignorando ids viejos", () => {
    expect(permisosEfectivos({ admin: false, granted: ["editar-casa", "reloj"], everyone: ["anunciar", "editar-casa"] })).toEqual([
      "anunciar",
      "editar-casa",
    ]);
  });

  it("puede: admin siempre, si no según la lista", () => {
    expect(puede({ admin: true, permisos: [] }, "anunciar")).toBe(true);
    expect(puede({ admin: false, permisos: ["anunciar"] }, "anunciar")).toBe(true);
    expect(puede({ admin: false, permisos: ["anunciar"] }, "editar-casa")).toBe(false);
    expect(puede({}, "anunciar")).toBe(false);
    expect(puede(undefined, "anunciar")).toBe(false);
  });
});
