import { describe, expect, it } from "vitest";
import type { Availability } from "../api/types";
import { huecosDelDia } from "./huecos";

const av = (slots: { start: string; options: { providerId: string; providerName: string }[] }[]): Availability => ({
  date: "2026-10-21",
  serviceId: "s1",
  durationMinutes: 60,
  slots: slots.map((s) => ({ start: s.start, end: "00:00", options: s.options.map((o) => ({ ...o, machineId: null })) })),
});

const ROMINA = { providerId: "p1", providerName: "Romina" };
const TAMARA = { providerId: "p2", providerName: "Tamara" };
const VIERNES_0930 = new Date("2026-10-16T12:30:00Z");

describe("huecosDelDia", () => {
  it("dos opciones en el mismo slot son dos huecos", () => {
    const r = huecosDelDia(av([{ start: "10:30", options: [ROMINA, TAMARA] }]), "2026-10-21", null, VIERNES_0930);
    expect(r).toEqual([
      { dia: "2026-10-21", minutos: 630, providerId: "p1", providerName: "Romina", serviceId: "s1" },
      { dia: "2026-10-21", minutos: 630, providerId: "p2", providerName: "Tamara", serviceId: "s1" },
    ]);
  });

  it("un slot de hoy que ya pasó queda afuera", () => {
    const a = av([{ start: "09:00", options: [ROMINA] }, { start: "10:00", options: [ROMINA] }]);
    const r = huecosDelDia(a, "2026-10-16", null, VIERNES_0930);
    expect(r.map((h) => h.minutos)).toEqual([600]);
  });

  it("soloDe deja nada más que a esa prestadora", () => {
    const r = huecosDelDia(av([{ start: "10:30", options: [ROMINA, TAMARA] }]), "2026-10-21", ["p2"], VIERNES_0930);
    expect(r.map((h) => h.providerId)).toEqual(["p2"]);
  });
});
