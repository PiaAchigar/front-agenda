import { describe, expect, it } from "vitest";
import {
  agregarAlFiltro,
  escribirBusqueda,
  leerBusqueda,
  prestadorasVisibles,
  quitarDelFiltro,
  sugerencias,
} from "./busqueda-agenda";

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
  it("lee todas las prestadoras y servicios repetidos", () => {
    expect(leerBusqueda(new URLSearchParams("prestadora=p1&prestadora=p2&servicio=s1&date=d"))).toEqual({
      prestadoras: ["p1", "p2"],
      servicios: ["s1"],
    });
    expect(leerBusqueda(new URLSearchParams("date=2026-10-19"))).toEqual({ prestadoras: [], servicios: [] });
  });

  it("ida y vuelta, sin tocar los demás parámetros", () => {
    const b = { prestadoras: ["p2", "p3"], servicios: ["s1", "s2"] };
    const p = escribirBusqueda(new URLSearchParams("date=2026-10-19"), b);
    expect(p.get("date")).toBe("2026-10-19");
    expect(p.getAll("prestadora")).toEqual(["p2", "p3"]);
    expect(leerBusqueda(p)).toEqual(b);
  });

  it("escribir pisa lo anterior y borra el viejo `con`", () => {
    const p = escribirBusqueda(new URLSearchParams("prestadora=p1&servicio=s9&con=x"), {
      prestadoras: [],
      servicios: ["s1"],
    });
    expect(p.has("prestadora")).toBe(false);
    expect(p.getAll("servicio")).toEqual(["s1"]);
    expect(p.has("con")).toBe(false);
  });

  it("limpiar borra todo menos lo demás", () => {
    const p = escribirBusqueda(new URLSearchParams("servicio=s1&servicio=s2&prestadora=p1&date=d"), {
      prestadoras: [],
      servicios: [],
    });
    expect(p.toString()).toBe("date=d");
  });
});

describe("agregarAlFiltro / quitarDelFiltro", () => {
  const vacia = { prestadoras: [], servicios: [] };

  it("agrega en orden y elegir una ya elegida no hace nada", () => {
    const a = agregarAlFiltro(vacia, "prestadora", "p1");
    const b = agregarAlFiltro(agregarAlFiltro(a, "servicio", "s1"), "prestadora", "p2");
    expect(b).toEqual({ prestadoras: ["p1", "p2"], servicios: ["s1"] });
    expect(agregarAlFiltro(b, "prestadora", "p1")).toEqual(b);
  });

  it("quitar saca sólo esa", () => {
    const b = { prestadoras: ["p1", "p2"], servicios: ["s1", "s2"] };
    expect(quitarDelFiltro(b, "prestadora", "p1")).toEqual({ prestadoras: ["p2"], servicios: ["s1", "s2"] });
    expect(quitarDelFiltro(b, "servicio", "s2")).toEqual({ prestadoras: ["p1", "p2"], servicios: ["s1"] });
  });
});

describe("prestadorasVisibles", () => {
  it("las elegidas, si hay", () => {
    expect(prestadorasVisibles({ prestadoras: ["p1"], servicios: ["s1"] }, ["p2", "p3"])).toEqual(["p1"]);
  });
  it("sin elegidas, las que hacen algún servicio elegido", () => {
    expect(prestadorasVisibles({ prestadoras: [], servicios: ["s1", "s2"] }, ["p2", "p3"])).toEqual(["p2", "p3"]);
  });
  it("sin filtro, todas (undefined)", () => {
    expect(prestadorasVisibles({ prestadoras: [], servicios: [] }, [])).toBeUndefined();
  });
});
