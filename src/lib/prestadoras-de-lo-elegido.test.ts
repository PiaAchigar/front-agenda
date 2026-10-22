import { describe, expect, it } from "vitest";
import type { AvailabilitySlot } from "../api/types";
import { gruposDePrestadoras, libertadEnHora, type QuienLoHace } from "./prestadoras-de-lo-elegido";

const lu: QuienLoHace = { providerId: "lu", nombre: "Lu", hace: ["Limpieza", "Masaje"], serviceIds: ["s1", "s2"], todo: true };
const gabi: QuienLoHace = { providerId: "gabi", nombre: "Gabi", hace: ["Limpieza"], serviceIds: ["s1"], todo: false };
const ro: QuienLoHace = { providerId: "ro", nombre: "Romina", hace: ["Limpieza"], serviceIds: ["s1"], todo: true };

const slot = (start: string, ...provs: string[]): AvailabilitySlot => ({
  start, end: start, options: provs.map((p) => ({ providerId: p, providerName: p, machineId: null })),
});

describe("libertadEnHora", () => {
  const slots = [slot("15:30", "lu"), slot("16:00", "lu"), slot("16:30", "lu", "gabi")];
  it("libre si tiene ese horario", () => {
    expect(libertadEnHora(slots, "lu", "15:30")).toEqual({ libre: true, desde: null });
  });
  it("ocupada: dice desde cuándo está libre ese día", () => {
    expect(libertadEnHora(slots, "gabi", "15:30")).toEqual({ libre: false, desde: "16:30" });
  });
  it("sin más lugar ese día: desde null", () => {
    expect(libertadEnHora(slots, "ro", "15:30")).toEqual({ libre: false, desde: null });
  });
});

describe("gruposDePrestadoras", () => {
  const textos = (g: ReturnType<typeof gruposDePrestadoras>) => g.map((x) => [x.titulo, x.opciones.map((o) => o.texto)]);

  it("un servicio sin hora: una sola lista, sin títulos", () => {
    expect(textos(gruposDePrestadoras([lu, ro], () => null, null))).toEqual([[null, ["Lu", "Romina"]]]);
  });

  it("un combo sin hora: 'Hacen todo' y 'Hacen una parte' con lo que hace", () => {
    expect(textos(gruposDePrestadoras([lu, gabi], () => null, null))).toEqual([
      ["Hacen todo", ["Lu"]],
      ["Hacen una parte", ["Gabi — sólo Limpieza"]],
    ]);
  });

  it("con hora y la libertad de todas: libres arriba, ocupadas con desde cuándo", () => {
    const libertad = (q: QuienLoHace) =>
      q.providerId === "gabi" ? { libre: false, desde: "16:30" } : q.providerId === "ro" ? { libre: false, desde: null } : { libre: true, desde: null };
    expect(textos(gruposDePrestadoras([lu, ro, gabi], libertad, "15:30"))).toEqual([
      ["Libres a las 15:30", ["Lu"]],
      ["Ocupadas a esa hora", ["Romina · sin lugar ese día", "Gabi — sólo Limpieza · libre desde 16:30"]],
    ]);
  });

  it("si falta la libertad de alguna (cargando o falló), no se agrupa por libres: nunca miente", () => {
    const libertad = (q: QuienLoHace) => (q.providerId === "lu" ? { libre: true, desde: null } : null);
    expect(textos(gruposDePrestadoras([lu, ro], libertad, "15:30"))).toEqual([[null, ["Lu", "Romina"]]]);
  });

  it("sin nadie: sin grupos", () => {
    expect(gruposDePrestadoras([], () => null, null)).toEqual([]);
  });
});
