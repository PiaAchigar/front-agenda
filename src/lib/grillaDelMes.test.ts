import { describe, expect, it } from "vitest";
import {
  diasDeLaGrilla,
  etiquetaDelMes,
  mesAnterior,
  mesSiguiente,
  utcDate,
  ymd,
} from "./grillaDelMes";

describe("ymd / utcDate", () => {
  it("arma la fecha con ceros", () => {
    expect(ymd(2026, 0, 5)).toBe("2026-01-05");
    expect(ymd(2026, 11, 31)).toBe("2026-12-31");
  });

  it("utcDate cae al mediodía UTC (no cambia de día en Argentina)", () => {
    expect(utcDate("2026-10-15").toISOString()).toBe("2026-10-15T12:00:00.000Z");
  });
});

describe("diasDeLaGrilla", () => {
  it("octubre 2026 arranca un jueves: la grilla empieza el lunes 28/09 y tiene 5 semanas", () => {
    const { year, month0, days } = diasDeLaGrilla("2026-10-15");
    expect(year).toBe(2026);
    expect(month0).toBe(9);
    expect(days).toHaveLength(35);
    expect(days[0]).toBe("2026-09-28");
    expect(days[34]).toBe("2026-11-01");
  });

  it("febrero 2027 arranca un lunes y tiene 28 días: 4 semanas justas, sin relleno", () => {
    const { days } = diasDeLaGrilla("2027-02-10");
    expect(days).toHaveLength(28);
    expect(days[0]).toBe("2027-02-01");
    expect(days[27]).toBe("2027-02-28");
  });

  it("un mes que arranca domingo lleva 6 días de relleno al principio", () => {
    // 1 de febrero de 2026 es domingo.
    const { days } = diasDeLaGrilla("2026-02-01");
    expect(days[0]).toBe("2026-01-26");
    expect(days[6]).toBe("2026-02-01");
  });
});

describe("etiquetaDelMes", () => {
  it("mes y año en español, con mayúscula", () => {
    // `toLocaleDateString("es-AR", { month: "long", year: "numeric" })` incluye el "de".
    expect(etiquetaDelMes(2026, 9)).toBe("Octubre de 2026");
  });
});

describe("mesSiguiente / mesAnterior", () => {
  it("avanza y retrocede un mes", () => {
    expect(mesSiguiente("2026-10")).toBe("2026-11");
    expect(mesAnterior("2026-10")).toBe("2026-09");
  });

  it("cruza el año", () => {
    expect(mesSiguiente("2026-12")).toBe("2027-01");
    expect(mesAnterior("2027-01")).toBe("2026-12");
  });

  it("no se saltea febrero", () => {
    expect(mesSiguiente("2027-01")).toBe("2027-02");
    expect(mesSiguiente("2027-02")).toBe("2027-03");
    expect(mesAnterior("2027-03")).toBe("2027-02");
  });
});
