import { describe, expect, it } from "vitest";
import { sePuedeCobrar, type TurnoParaAcciones } from "./acciones-del-turno";

const turno = (extra: Partial<TurnoParaAcciones> = {}): TurnoParaAcciones => ({
  status: "scheduled",
  customerId: "cli1",
  customerPurchaseServiceId: null,
  ...extra,
});

describe("sePuedeCobrar", () => {
  it("un turno normal se cobra", () => {
    expect(sePuedeCobrar(turno(), true)).toBe(true);
  });

  it("uno que sale de una compra NO: ya se pagó del otro lado", () => {
    // El error caro: "Cobrar" manda a facturar el precio del servicio, o sea
    // se lo cobraría por segunda vez.
    expect(sePuedeCobrar(turno({ customerPurchaseServiceId: "cps1" }), true)).toBe(false);
  });

  it("cancelado y ausente tampoco", () => {
    expect(sePuedeCobrar(turno({ status: "cancelled" }), true)).toBe(false);
    expect(sePuedeCobrar(turno({ status: "no_show" }), true)).toBe(false);
  });

  it("sin clienta no hay a quién facturarle", () => {
    expect(sePuedeCobrar(turno({ customerId: null }), true)).toBe(false);
  });

  it("fuera del dashboard no hay facturación a la que ir", () => {
    expect(sePuedeCobrar(turno(), false)).toBe(false);
  });
});
