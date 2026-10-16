import { describe, expect, it } from "vitest";
import type { Consumible } from "../api/agenda";
import { compraInicial } from "./compra-preferida";

const opcion = (purchaseId: string, purchaseServiceId: string) => ({
  purchaseId, purchaseServiceId, descripcion: purchaseId, disponibles: 1, venceEl: null,
});

describe("compraInicial", () => {
  it("una sola compra: se elige sola, como hoy", () => {
    const c: Consumible = { tipo: "automatica", purchaseServiceId: "ps-a", opcion: opcion("pu-a", "ps-a") };
    expect(compraInicial(c, null)).toBe("ps-a");
  });

  it("varias, sin preferida: no se elige ninguna, como hoy", () => {
    const c: Consumible = { tipo: "elige_laura", opciones: [opcion("pu-a", "ps-a"), opcion("pu-b", "ps-b")] };
    expect(compraInicial(c, null)).toBeNull();
  });

  it("varias, con la recién vendida: arranca elegida esa", () => {
    const c: Consumible = { tipo: "elige_laura", opciones: [opcion("pu-a", "ps-a"), opcion("pu-b", "ps-b")] };
    expect(compraInicial(c, "pu-b")).toBe("ps-b");
  });

  it("una preferida que no está entre las opciones no elige nada", () => {
    const c: Consumible = { tipo: "elige_laura", opciones: [opcion("pu-a", "ps-a")] };
    expect(compraInicial(c, "pu-x")).toBeNull();
  });

  it("sin consumible o 'ninguna': null", () => {
    expect(compraInicial(undefined, "pu-a")).toBeNull();
    expect(compraInicial({ tipo: "ninguna" }, "pu-a")).toBeNull();
  });
});
