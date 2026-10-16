import { describe, expect, it } from "vitest";
import type { LineaDeCompra } from "../api/ventas";
import { laHace, opcionesParaElTurno, prefillDeTraspaso, preseleccion } from "./que-va-en-el-turno";

const linea = (p: Partial<LineaDeCompra> & Pick<LineaDeCompra, "id">): LineaDeCompra => ({
  serviceId: null, depilationComboId: null, serviceName: null, estado: "disponible", ...p,
});

const COMBO = {
  description: "Combo Glow",
  servicios: [
    linea({ id: "l1", serviceId: "svc-limpieza", serviceName: "Limpieza" }),
    linea({ id: "l2", serviceId: "svc-limpieza", serviceName: "Limpieza" }),
    linea({ id: "l3", serviceId: "svc-peeling", serviceName: "Peeling" }),
    linea({ id: "l4", serviceId: "svc-masaje", serviceName: "Masaje", estado: "agendada" }),
  ],
};
const DEPI = {
  description: "Pack Piernas x6",
  servicios: [linea({ id: "d1", depilationComboId: "dc1" }), linea({ id: "d2", depilationComboId: "dc1" })],
};

describe("opcionesParaElTurno", () => {
  it("una opción por servicio distinto con algo disponible, la primera línea de cada uno", () => {
    expect(opcionesParaElTurno(COMBO).map((o) => [o.clave, o.purchaseServiceId, o.nombre])).toEqual([
      ["svc-limpieza", "l1", "Limpieza"],
      ["svc-peeling", "l3", "Peeling"],
    ]);
  });

  it("una línea de depilación usa la descripción de la compra como nombre", () => {
    const [o] = opcionesParaElTurno(DEPI);
    expect(o).toMatchObject({ clave: "depi:dc1", purchaseServiceId: "d1", esDepilacion: true, nombre: "Pack Piernas x6" });
  });

  it("una línea de capacitación (los dos ids en null) no es para un turno", () => {
    expect(opcionesParaElTurno({ description: "Curso", servicios: [linea({ id: "t1" })] })).toEqual([]);
  });
});

describe("preseleccion", () => {
  const opciones = opcionesParaElTurno(COMBO);

  it("una sola opción: esa", () => {
    expect(preseleccion(opciones.slice(0, 1), ["svc-otro"])).toBe("svc-limpieza");
  });

  it("varias: la única que hace la profesional del hueco", () => {
    expect(preseleccion(opciones, ["svc-peeling"])).toBe("svc-peeling");
  });

  it("varias que hace, o ninguna, o sin profesional: no preselecciona", () => {
    expect(preseleccion(opciones, ["svc-peeling", "svc-limpieza"])).toBeNull();
    expect(preseleccion(opciones, [])).toBeNull();
    expect(preseleccion(opciones, null)).toBeNull();
  });
});

describe("laHace", () => {
  it("sin profesional fija, cualquiera; depilación siempre (lo valida la API)", () => {
    const [limpieza] = opcionesParaElTurno(COMBO);
    const [depi] = opcionesParaElTurno(DEPI);
    expect(laHace(limpieza!, null)).toBe(true);
    expect(laHace(limpieza!, ["svc-peeling"])).toBe(false);
    expect(laHace(depi!, [])).toBe(true);
  });
});

describe("prefillDeTraspaso", () => {
  const hueco = { providerId: "prov1", providerName: "Sofía", minutes: 930 };

  it("un servicio: serviceId + la compra recién vendida + la profesional que lo hace", () => {
    const [limpieza] = opcionesParaElTurno(COMBO);
    expect(
      prefillDeTraspaso({ opcion: limpieza!, compraId: "pu9", customerId: "cu1", hueco, serviciosDeLaProfesional: ["svc-limpieza"] }),
    ).toEqual({ customerId: "cu1", serviceId: "svc-limpieza", compraPreferidaId: "pu9", minutes: 930, providerId: "prov1", providerName: "Sofía" });
  });

  it("si la profesional del hueco no hace el servicio, NO se fija profesional", () => {
    const [limpieza] = opcionesParaElTurno(COMBO);
    expect(
      prefillDeTraspaso({ opcion: limpieza!, compraId: "pu9", customerId: "cu1", hueco, serviciosDeLaProfesional: ["svc-peeling"] }),
    ).toEqual({ customerId: "cu1", serviceId: "svc-limpieza", compraPreferidaId: "pu9", minutes: 930 });
  });

  it("depilación: el mismo camino que 'A agendar' (purchaseServiceId)", () => {
    const [depi] = opcionesParaElTurno(DEPI);
    expect(
      prefillDeTraspaso({ opcion: depi!, compraId: "pu9", customerId: "cu1", hueco, serviciosDeLaProfesional: [] }),
    ).toEqual({ customerId: "cu1", purchaseServiceId: "d1", minutes: 930, providerId: "prov1", providerName: "Sofía" });
  });

  it("depilación y la profesional del hueco NO hace el servicio ancla: sin profesional fija", () => {
    const [depi] = opcionesParaElTurno(DEPI);
    expect(
      prefillDeTraspaso({ opcion: depi!, compraId: "pu9", customerId: "cu1", hueco, serviciosDeLaProfesional: ["svc-otro"], anclaDepilacion: "svc-ancla" }),
    ).toEqual({ customerId: "cu1", purchaseServiceId: "d1", minutes: 930 });
  });

  it("depilación y la profesional hace el ancla: queda fija", () => {
    const [depi] = opcionesParaElTurno(DEPI);
    expect(
      prefillDeTraspaso({ opcion: depi!, compraId: "pu9", customerId: "cu1", hueco, serviciosDeLaProfesional: ["svc-ancla"], anclaDepilacion: "svc-ancla" }),
    ).toEqual({ customerId: "cu1", purchaseServiceId: "d1", minutes: 930, providerId: "prov1", providerName: "Sofía" });
  });

  it("depilación con ancla desconocida (no se pudo leer): sin profesional fija", () => {
    const [depi] = opcionesParaElTurno(DEPI);
    expect(
      prefillDeTraspaso({ opcion: depi!, compraId: "pu9", customerId: "cu1", hueco, serviciosDeLaProfesional: ["svc-ancla"], anclaDepilacion: null }),
    ).toEqual({ customerId: "cu1", purchaseServiceId: "d1", minutes: 930 });
  });
});

describe("laHace con ancla de depilación", () => {
  it("depilación se compara contra el servicio ancla", () => {
    const [depi] = opcionesParaElTurno(DEPI);
    expect(laHace(depi!, ["svc-ancla"], "svc-ancla")).toBe(true);
    expect(laHace(depi!, ["svc-otro"], "svc-ancla")).toBe(false);
    expect(laHace(depi!, ["svc-ancla"], null)).toBe(false);
    expect(laHace(depi!, null, "svc-ancla")).toBe(true);
  });
});
