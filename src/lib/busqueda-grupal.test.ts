import { describe, expect, it } from "vitest";
import type { ClassOccurrence } from "../api/types";
import { claseVisible, escribirBusquedaGrupal, leerBusquedaGrupal } from "./busqueda-grupal";

const clase = (kind: "activity" | "training", subjectId: string) =>
  ({ kind, subjectId }) as unknown as ClassOccurrence;

describe("claseVisible", () => {
  const vacia = { actividades: [], capacitaciones: [] };
  it("sin filtro deja ver todo", () => {
    expect(claseVisible(clase("activity", "a"), vacia)).toBe(true);
    expect(claseVisible(clase("training", "t"), vacia)).toBe(true);
  });
  it("una actividad elegida deja ver sólo esa", () => {
    const b = { actividades: ["a"], capacitaciones: [] };
    expect(claseVisible(clase("activity", "a"), b)).toBe(true);
    expect(claseVisible(clase("activity", "b"), b)).toBe(false);
    expect(claseVisible(clase("training", "t"), b)).toBe(false);
  });
  it("actividad y capacitación elegidas dejan ver las dos", () => {
    const b = { actividades: ["a"], capacitaciones: ["t"] };
    expect(claseVisible(clase("activity", "a"), b)).toBe(true);
    expect(claseVisible(clase("training", "t"), b)).toBe(true);
    expect(claseVisible(clase("training", "x"), b)).toBe(false);
  });
  it("manda el kind: el mismo id en otro tipo no filtra", () => {
    const b = { actividades: ["x"], capacitaciones: [] };
    expect(claseVisible(clase("training", "x"), b)).toBe(false);
  });
});

describe("escribirBusquedaGrupal", () => {
  it("conserva prestadora/servicio/date y repite actividad/capacitacion", () => {
    const params = new URLSearchParams("date=2026-10-21&prestadora=p&servicio=s&actividad=viejo");
    const r = escribirBusquedaGrupal(params, { actividades: ["a1", "a2"], capacitaciones: ["t1"] });
    expect(r.get("date")).toBe("2026-10-21");
    expect(r.getAll("prestadora")).toEqual(["p"]);
    expect(r.getAll("servicio")).toEqual(["s"]);
    expect(r.getAll("actividad")).toEqual(["a1", "a2"]);
    expect(r.getAll("capacitacion")).toEqual(["t1"]);
    expect(leerBusquedaGrupal(r)).toEqual({ actividades: ["a1", "a2"], capacitaciones: ["t1"] });
  });
});
