import { describe, expect, it } from "vitest";
import { debeDelTurno } from "./deuda-del-turno";

describe("debeDelTurno", () => {
  it("devuelve la deuda de la compra tal cual viene", () => {
    expect(debeDelTurno({ deudaDeLaCompra: 6000, status: "scheduled" })).toBe(6000);
    expect(debeDelTurno({ deudaDeLaCompra: 6000, status: "reserved" })).toBe(6000);
    expect(debeDelTurno({ deudaDeLaCompra: 6000, status: "completed" })).toBe(6000);
  });

  it("null si no hay deuda: compra paga (0), sin compra (null) o dato ausente", () => {
    expect(debeDelTurno({ deudaDeLaCompra: 0, status: "scheduled" })).toBeNull();
    expect(debeDelTurno({ deudaDeLaCompra: null, status: "scheduled" })).toBeNull();
    expect(debeDelTurno({ status: "scheduled" })).toBeNull();
  });

  it("null en un turno cancelado o ausente, aunque la compra deba", () => {
    expect(debeDelTurno({ deudaDeLaCompra: 6000, status: "cancelled" })).toBeNull();
    expect(debeDelTurno({ deudaDeLaCompra: 6000, status: "no_show" })).toBeNull();
  });
});
