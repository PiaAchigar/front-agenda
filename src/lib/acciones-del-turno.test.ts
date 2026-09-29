import { describe, expect, it } from "vitest";
import {
  cancelarPuedeDevolverSenia,
  sePuedeCambiarEstado,
  sePuedeCobrar,
  type TurnoParaAcciones,
} from "./acciones-del-turno";

const turno = (extra: Partial<TurnoParaAcciones> = {}): TurnoParaAcciones => ({
  status: "scheduled",
  customerId: "cli1",
  customerPurchaseServiceId: null,
  appointmentStart: "2026-09-29T16:00:00.000Z",
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

describe("sePuedeCambiarEstado", () => {
  it("un turno completado está cerrado", () => {
    expect(sePuedeCambiarEstado(turno({ status: "completed" }))).toBe(false);
  });

  it("los demás estados siguen siendo editables", () => {
    for (const status of ["scheduled", "reserved", "cancelled", "no_show"]) {
      expect(sePuedeCambiarEstado(turno({ status }))).toBe(true);
    }
  });

  // Cobrar no es un cambio de estado: un turno realizado es justamente el que
  // se factura, así que cerrarlo para estados no puede cerrarlo para cobrar.
  it("un turno completado se sigue pudiendo cobrar", () => {
    expect(sePuedeCobrar(turno({ status: "completed" }), true)).toBe(true);
  });
});

describe("cancelarPuedeDevolverSenia", () => {
  const AHORA = new Date("2026-09-29T17:00:00.000Z");

  it("pasada la hora del turno ya no devuelve nada", () => {
    // El caso REAL de un ausente: se marca después de que la clienta no vino.
    expect(cancelarPuedeDevolverSenia(turno(), AHORA)).toBe(false);
  });

  it("antes de la hora todavía está a tiempo", () => {
    const antes = turno({ appointmentStart: "2026-09-29T18:00:00.000Z" });
    expect(cancelarPuedeDevolverSenia(antes, AHORA)).toBe(true);
  });
});
