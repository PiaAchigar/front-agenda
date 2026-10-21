import { describe, expect, it } from "vitest";
import type { ClassOccurrence } from "../api/types";
import { COLOR_DE_TIPO, ESTILO_DEBE, estadoDeClase } from "./estado-de-clase";

const AHORA = new Date("2026-10-20T12:00:00.000Z");
const clase = (capacity: number | null, enrolledCount: number, startsAt = "2026-10-21T13:00:00.000Z") =>
  ({ capacity, enrolledCount, startsAt }) as ClassOccurrence;

describe("estadoDeClase", () => {
  it("pasada gana a todo", () => {
    expect(estadoDeClase(clase(8, 9, "2026-10-20T11:00:00.000Z"), AHORA)).toBe("pasada");
  });
  it("9/8 es sobrecupo", () => expect(estadoDeClase(clase(8, 9), AHORA)).toBe("sobrecupo"));
  it("8/8 es llena", () => expect(estadoDeClase(clase(8, 8), AHORA)).toBe("llena"));
  it("7/8 es con lugar", () => expect(estadoDeClase(clase(8, 7), AHORA)).toBe("con-lugar"));
  it("sin cupo es con lugar", () => expect(estadoDeClase(clase(null, 30), AHORA)).toBe("con-lugar"));
});

describe("estilo de Debe", () => {
  it("es la pastilla ámbar, la misma en el día, la semana, el mes y Referencias", () => {
    expect(ESTILO_DEBE).toContain("rounded-full");
    expect(ESTILO_DEBE).toContain("bg-amber-100");
    expect(ESTILO_DEBE).toContain("text-amber-800");
  });
});

describe("color por tipo", () => {
  it("actividad y capacitación tienen colores distintos, con su nombre", () => {
    expect(COLOR_DE_TIPO.activity.nombre).toBe("Actividad");
    expect(COLOR_DE_TIPO.training.nombre).toBe("Capacitación");
    for (const k of ["pastilla", "punto", "insignia", "borde"] as const) {
      expect(COLOR_DE_TIPO.activity[k]).not.toBe(COLOR_DE_TIPO.training[k]);
    }
  });
});
