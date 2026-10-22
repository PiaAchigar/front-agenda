import { describe, expect, it } from "vitest";
import type { BaseDelPlanificador, SesionPlanificable } from "../api/planificador";
import type { AvailabilitySlot } from "../api/types";
import { armarPlan, avisos, elegirPrestadora, habilitacion, recalcular, type CardDelPlan } from "./planificador";

const ses = (i: number, p: Partial<SesionPlanificable> = {}): SesionPlanificable => ({
  purchaseServiceId: `ps${i}`,
  vuelta: 1,
  orden: i,
  nombre: `ZZ_QA_PLAN servicio ${i}`,
  serviceId: `s${i}`,
  esDepilacion: false,
  zonas: [],
  duracionMinutos: 60,
  juntos: false,
  ...p,
});

const base = (sesiones: SesionPlanificable[], p: Partial<BaseDelPlanificador> = {}): BaseDelPlanificador => ({
  compraId: "c1",
  customerId: "cu1",
  clienta: "ZZ_QA_PLAN Clienta",
  descripcion: "ZZ_QA_PLAN pack",
  intervalo: { dias: 30, cargado: true },
  venceEl: null,
  puerta: null,
  turnosDeLaClienta: [],
  sesiones,
  ...p,
});

const INICIO = { fecha: "2026-10-22", hora: "15:30", providerId: "p1", providerName: "Romina" };

describe("armarPlan", () => {
  it("pack de 6 cada 30 días desde el 22/10 15:30: fechas 22/10, 21/11, 21/12, … y todas a las 15:30", () => {
    const b = base([1, 2, 3, 4, 5, 6].map((i) => ses(i, { vuelta: i })));
    const cards = armarPlan(b, INICIO, 30);
    expect(cards.map((c) => c.fecha)).toEqual([
      "2026-10-22", "2026-11-21", "2026-12-21", "2027-01-20", "2027-02-19", "2027-03-21",
    ]);
    expect(cards.every((c) => c.hora === "15:30")).toBe(true);
    expect(cards.map((c) => c.paso)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(cards.every((c) => c.marcada && !c.tocada && c.providerId === "p1")).toBe(true);
  });

  it("combo juntos: las sesiones de una vuelta el mismo día, encadenadas (la 2ª empieza al terminar la 1ª)", () => {
    const b = base([
      ses(1, { vuelta: 1, orden: 1, juntos: true, duracionMinutos: 45 }),
      ses(2, { vuelta: 1, orden: 2, juntos: true, duracionMinutos: 60 }),
      ses(3, { vuelta: 2, orden: 1, juntos: true, duracionMinutos: 45 }),
      ses(4, { vuelta: 2, orden: 2, juntos: true, duracionMinutos: 60 }),
    ]);
    const cards = armarPlan(b, INICIO, 30);
    expect(cards.map((c) => [c.fecha, c.hora, c.paso])).toEqual([
      ["2026-10-22", "15:30", 0],
      ["2026-10-22", "16:15", 0],
      ["2026-11-21", "15:30", 1],
      ["2026-11-21", "16:15", 1],
    ]);
  });

  it("combo no juntos: cada card es un paso", () => {
    const b = base([ses(1), ses(2), ses(3)]);
    const cards = armarPlan(b, INICIO, 10);
    expect(cards.map((c) => [c.fecha, c.paso])).toEqual([
      ["2026-10-22", 0],
      ["2026-11-01", 1],
      ["2026-11-11", 2],
    ]);
  });
});

describe("recalcular", () => {
  it("recalcular con 21 días mueve las no tocadas y deja la tocada", () => {
    const cards = armarPlan(base([ses(1), ses(2), ses(3)]), INICIO, 30);
    cards[1] = { ...cards[1]!, fecha: "2026-11-25", tocada: true };
    const r = recalcular(cards, INICIO, 21);
    expect(r[0]!.fecha).toBe("2026-10-22");
    expect(r[1]!.fecha).toBe("2026-11-25");
    expect(r[2]!.fecha).toBe("2026-12-03");
    expect(r[2]!.hora).toBe("15:30");
  });
});

const card = (p: Partial<CardDelPlan> = {}): CardDelPlan => ({
  clave: "ps1",
  sesion: ses(1),
  paso: 0,
  fecha: "2026-10-22",
  hora: "15:30",
  providerId: "p1",
  marcada: true,
  tocada: false,
  ...p,
});
const opt = (providerId: string, machineId: string | null = null) => ({ providerId, providerName: `N-${providerId}`, machineId });
const slot = (start: string, ...options: ReturnType<typeof opt>[]): AvailabilitySlot => ({ start, end: "00:00", options });

describe("elegirPrestadora", () => {
  it("elegirPrestadora prefiere la preferida si está libre; si no, la primera libre que no use otra card a esa hora", () => {
    const slots = [slot("15:30", opt("p1"), opt("p2"), opt("p3"))];
    const c = card({ clave: "ps2", sesion: ses(2) });
    expect(elegirPrestadora(c, slots, [], "p2")).toMatchObject({ libre: true, providerId: "p2" });
    const otra = card({ clave: "ps1", providerId: "p1" });
    expect(elegirPrestadora(c, slots, [otra], "p1")).toMatchObject({ libre: true, providerId: "p2" });
    const otra2 = card({ clave: "ps3", sesion: ses(3), providerId: "p2" });
    expect(elegirPrestadora(c, slots, [otra, otra2], "p1")).toMatchObject({ libre: true, providerId: "p3" });
  });

  it("elegirPrestadora sin nadie libre: libre false con libreDesde el próximo inicio del día", () => {
    const slots = [slot("15:30"), slot("16:00"), slot("17:00", opt("p1"))];
    const r = elegirPrestadora(card(), slots, [], "p1");
    expect(r).toEqual({ libre: false, libreDesde: "17:00" });
    expect(elegirPrestadora(card(), [slot("15:30")], [], "p1")).toEqual({ libre: false, libreDesde: null });
  });
});

describe("avisos", () => {
  it("avisos: fuera de vigencia si la fecha pasa venceEl; superpuesta con otra card marcada o con turnosDeLaClienta", () => {
    const b = base([ses(1), ses(2)], { venceEl: "2026-11-30" });
    const c1 = card();
    expect(avisos(c1, [c1], b)).toEqual({ fueraDeVigencia: false, superpuesta: false });
    expect(avisos(card({ fecha: "2026-12-01" }), [], b).fueraDeVigencia).toBe(true);

    const c2 = card({ clave: "ps2", sesion: ses(2), hora: "16:15" }); // pisa 15:30–16:30
    expect(avisos(c1, [c1, c2], b).superpuesta).toBe(true);
    expect(avisos(c1, [c1, { ...c2, marcada: false }], b).superpuesta).toBe(false);
    expect(avisos(c1, [c1, { ...c2, hora: "16:30" }], b).superpuesta).toBe(false);

    // 15:45–16:45 ART = 18:45–19:45 UTC
    const conTurno = base([ses(1)], { turnosDeLaClienta: [{ start: "2026-10-22T18:45:00Z", end: "2026-10-22T19:45:00Z" }] });
    expect(avisos(c1, [c1], conTurno).superpuesta).toBe(true);
    const otroDia = base([ses(1)], { turnosDeLaClienta: [{ start: "2026-10-23T18:45:00Z", end: "2026-10-23T19:45:00Z" }] });
    expect(avisos(c1, [c1], otroDia).superpuesta).toBe(false);
  });
});

describe("habilitacion", () => {
  const cards6 = () => armarPlan(base([1, 2, 3, 4, 5, 6].map((i) => ses(i, { vuelta: i, esDepilacion: true }))), INICIO, 30);

  it("habilitacion: con pagado < minimo, sólo la card 1 y como reserva; el resto 'Se agendan cuando esté pago el 40%'", () => {
    const b = base(cards6().map((c) => c.sesion), { puerta: { total: 100000, pagado: 10000, minimo: 40000 } });
    const h = habilitacion(cards6(), b, 6);
    expect(h.get("ps1")).toEqual({ habilitada: true, reserva: true });
    for (const k of ["ps2", "ps3", "ps4", "ps5", "ps6"]) {
      expect(h.get(k)).toEqual({ habilitada: false, motivo: "Se agendan cuando esté pago el 40%" });
    }
  });

  it("habilitacion: con todas marcadas y pagado < total, la última dice 'Se agenda cuando esté pago el total (faltan $X)'; si se desmarca una, la última se habilita", () => {
    const b = base(cards6().map((c) => c.sesion), { puerta: { total: 100000, pagado: 50000, minimo: 40000 } });
    const cs = cards6();
    const h = habilitacion(cs, b, 6);
    expect(h.get("ps5")).toEqual({ habilitada: true });
    expect(h.get("ps6")).toEqual({
      habilitada: false,
      motivo: `Se agenda cuando esté pago el total (faltan ${(50000).toLocaleString("es-AR").replace(/^/, "$")})`,
    });
    cs[2] = { ...cs[2]!, marcada: false };
    const h2 = habilitacion(cs, b, 6);
    expect(h2.get("ps6")).toEqual({ habilitada: true });
  });

  it("habilitacion: puerta null (no depilación) habilita todo", () => {
    const cs = cards6();
    const h = habilitacion(cs, base(cs.map((c) => c.sesion)), 6);
    expect([...h.values()].every((v) => v.habilitada)).toBe(true);
    expect(h.size).toBe(6);
  });
});
