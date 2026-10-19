import { describe, expect, it } from "vitest";
import { escribirBusqueda, leerBusqueda, sugerencias } from "./busqueda-agenda";

const PRESTADORAS = [
  { id: "p1", name: "Romina Suárez" },
  { id: "p2", name: "Gabi Médica" },
  { id: "p3", name: "Laura Pérez" },
];
const SERVICIOS = [
  { id: "s1", name: "Rostro completo" },
  { id: "s2", name: "Médica estética" },
  { id: "s3", name: "Masaje" },
];

describe("sugerencias", () => {
  it("encuentra sin distinguir mayúsculas ni tildes", () => {
    const r = sugerencias("medic", PRESTADORAS, SERVICIOS);
    expect(r.servicios.map((s) => s.name)).toContain("Médica estética");
    expect(r.prestadoras.map((p) => p.name)).toContain("Gabi Médica");
    expect(sugerencias("SUAREZ", PRESTADORAS, SERVICIOS).prestadoras).toHaveLength(1);
  });

  it("separa prestadoras de servicios", () => {
    const r = sugerencias("ro", PRESTADORAS, SERVICIOS);
    expect(r.prestadoras.map((p) => p.name)).toEqual(["Romina Suárez"]);
    expect(r.servicios.map((s) => s.name)).toEqual(["Rostro completo"]);
  });

  it("respeta el máximo por grupo", () => {
    const muchas = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, name: `Ana ${i}` }));
    expect(sugerencias("ana", muchas, [], 3).prestadoras).toHaveLength(3);
    expect(sugerencias("ana", muchas, []).prestadoras).toHaveLength(6);
  });

  it("con menos de 2 letras no sugiere nada", () => {
    expect(sugerencias("r", PRESTADORAS, SERVICIOS)).toEqual({ prestadoras: [], servicios: [] });
    expect(sugerencias("  r ", PRESTADORAS, SERVICIOS)).toEqual({ prestadoras: [], servicios: [] });
  });
});

describe("leerBusqueda / escribirBusqueda", () => {
  it("lee prestadora, servicio o nada", () => {
    expect(leerBusqueda(new URLSearchParams("prestadora=p1"))).toEqual({ tipo: "prestadora", id: "p1" });
    expect(leerBusqueda(new URLSearchParams("servicio=s1"))).toEqual({ tipo: "servicio", id: "s1" });
    expect(leerBusqueda(new URLSearchParams("date=2026-10-19"))).toBeNull();
  });

  it("si están los dos, gana servicio", () => {
    expect(leerBusqueda(new URLSearchParams("prestadora=p1&servicio=s1"))).toEqual({
      tipo: "servicio",
      id: "s1",
    });
  });

  it("ida y vuelta, sin tocar los demás parámetros", () => {
    const p = escribirBusqueda(new URLSearchParams("date=2026-10-19"), { tipo: "prestadora", id: "p2" });
    expect(p.get("date")).toBe("2026-10-19");
    expect(leerBusqueda(p)).toEqual({ tipo: "prestadora", id: "p2" });
  });

  it("cambiar de búsqueda deja una sola y borra `con`", () => {
    const p = escribirBusqueda(new URLSearchParams("prestadora=p1&con=x"), { tipo: "servicio", id: "s1" });
    expect(p.get("prestadora")).toBeNull();
    expect(p.get("servicio")).toBe("s1");
    expect(p.has("con")).toBe(false);
  });

  it("limpiar borra prestadora, servicio y con", () => {
    const p = escribirBusqueda(new URLSearchParams("servicio=s1&con=x&date=d"), null);
    expect(p.toString()).toBe("date=d");
  });
});
