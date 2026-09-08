import { describe, expect, it } from "vitest";
import { isoToDateAndTime, toArgentinaISO } from "./reagendar";

describe("toArgentinaISO", () => {
  it("pega fecha y hora con el offset argentino", () => {
    expect(toArgentinaISO("2026-09-15", "10:00")).toBe("2026-09-15T10:00:00-03:00");
  });

  it("el offset es fijo, no el del navegador", () => {
    // Si tomara el offset local, reagendar desde una compu en otra zona horaria
    // guardaría el turno corrido y nadie se enteraría hasta que la clienta
    // llegara a la hora equivocada.
    expect(toArgentinaISO("2026-01-15", "10:00")).toContain("-03:00");
    expect(toArgentinaISO("2026-07-15", "10:00")).toContain("-03:00");
  });

  it("lo que arma es la misma hora que se eligió, en UTC +3", () => {
    expect(new Date(toArgentinaISO("2026-09-15", "10:00")).toISOString()).toBe(
      "2026-09-15T13:00:00.000Z",
    );
  });
});

describe("isoToDateAndTime", () => {
  it("convierte UTC a hora argentina", () => {
    expect(isoToDateAndTime("2026-09-15T13:00:00.000Z")).toEqual({
      date: "2026-09-15",
      time: "10:00",
    });
  });

  it("un turno temprano no se va al día anterior", () => {
    // 2026-09-15 02:00 UTC son las 23:00 del 14 en Argentina. Si la conversión
    // se hiciera con getDate() del navegador, el input de fecha mostraría el
    // día equivocado.
    expect(isoToDateAndTime("2026-09-15T02:00:00.000Z")).toEqual({
      date: "2026-09-14",
      time: "23:00",
    });
  });

  it("usa 24 horas, no am/pm", () => {
    expect(isoToDateAndTime("2026-09-15T20:30:00.000Z").time).toBe("17:30");
  });

  it("ida y vuelta devuelve el mismo instante", () => {
    const original = "2026-09-15T13:00:00.000Z";
    const { date, time } = isoToDateAndTime(original);
    expect(new Date(toArgentinaISO(date, time)).toISOString()).toBe(original);
  });
});
