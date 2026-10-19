import { describe, expect, it } from "vitest";
import { carriles } from "./carriles";

describe("carriles", () => {
  it("dos turnos que no se pisan ocupan todo el ancho cada uno", () => {
    const r = carriles([
      { id: "a", inicio: 540, fin: 600 },
      { id: "b", inicio: 600, fin: 660 },
    ]);
    expect(r.get("a")).toEqual({ carril: 0, total: 1 });
    expect(r.get("b")).toEqual({ carril: 0, total: 1 });
  });

  it("tres que se pisan van en carriles 0, 1 y 2 con total 3", () => {
    const r = carriles([
      { id: "a", inicio: 540, fin: 660 },
      { id: "b", inicio: 560, fin: 640 },
      { id: "c", inicio: 570, fin: 630 },
    ]);
    expect(r.get("a")).toEqual({ carril: 0, total: 3 });
    expect(r.get("b")).toEqual({ carril: 1, total: 3 });
    expect(r.get("c")).toEqual({ carril: 2, total: 3 });
  });

  it("si A pisa a B y B pisa a C pero A no a C, C reusa el carril 0", () => {
    const r = carriles([
      { id: "a", inicio: 540, fin: 600 },
      { id: "b", inicio: 580, fin: 660 },
      { id: "c", inicio: 610, fin: 700 },
    ]);
    expect(r.get("a")).toEqual({ carril: 0, total: 2 });
    expect(r.get("b")).toEqual({ carril: 1, total: 2 });
    expect(r.get("c")).toEqual({ carril: 0, total: 2 });
  });

  it("el total es el del grupo que se pisa, no el del día", () => {
    const r = carriles([
      { id: "a", inicio: 540, fin: 600 },
      { id: "b", inicio: 550, fin: 600 },
      { id: "c", inicio: 900, fin: 960 },
    ]);
    expect(r.get("a")?.total).toBe(2);
    expect(r.get("c")).toEqual({ carril: 0, total: 1 });
  });
});
