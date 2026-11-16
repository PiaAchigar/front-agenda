import { describe, expect, it } from "vitest";
import { EXPIRY_OPTIONS, EXPIRY_DEFAULT } from "./reservaVencimiento";

describe("opciones de vencimiento de la reserva", () => {
  it("sólo 6 y 12 horas", () => {
    expect(EXPIRY_OPTIONS).toEqual([
      { value: 360, label: "6 horas" },
      { value: 720, label: "12 horas" },
    ]);
  });
  it("por defecto 6 horas", () => {
    expect(EXPIRY_DEFAULT).toBe(360);
  });
});
