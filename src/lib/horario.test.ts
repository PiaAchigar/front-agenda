import { describe, expect, it } from "vitest";
import { ahoraEnArgentina, yaPaso } from "./horario";

// 12:30 UTC = 09:30 en Buenos Aires (UTC-3, sin horario de verano).
const NUEVE_Y_MEDIA = new Date("2026-10-16T12:30:00Z");

describe("yaPaso — siempre en hora argentina", () => {
  it("hoy: antes de ahora sí, ahora y después no", () => {
    expect(yaPaso("2026-10-16", 9 * 60, NUEVE_Y_MEDIA)).toBe(true);
    expect(yaPaso("2026-10-16", 9 * 60 + 30, NUEVE_Y_MEDIA)).toBe(false);
    expect(yaPaso("2026-10-16", 10 * 60, NUEVE_Y_MEDIA)).toBe(false);
  });
  it("ayer siempre; mañana nunca", () => {
    expect(yaPaso("2026-10-15", 23 * 60, NUEVE_Y_MEDIA)).toBe(true);
    expect(yaPaso("2026-10-17", 0, NUEVE_Y_MEDIA)).toBe(false);
  });
  it("borde de medianoche: 02:30 UTC del 17 todavía es 23:30 del 16 en ART", () => {
    const ahora = new Date("2026-10-17T02:30:00Z");
    expect(ahoraEnArgentina(ahora)).toEqual({ fecha: "2026-10-16", minutos: 23 * 60 + 30 });
    expect(yaPaso("2026-10-16", 23 * 60, ahora)).toBe(true);
    expect(yaPaso("2026-10-17", 9 * 60, ahora)).toBe(false);
  });
});
