import { describe, expect, it } from "vitest";
import type { Catalogo, ItemDeCatalogo, PromoVendible } from "../api/ventas";
import {
  CLAVE_PROMOS,
  CLAVE_SIN_AREA,
  areasParaVender,
  itemsDeUnaPromo,
  itemsDelArea,
  minutosDe,
  pedidoDeCotizacion,
  pesos,
  promosQueAplican,
  saldoQueEntra,
  sesionesEditables,
} from "./vender";

const ESTETICA = { id: "a-est", nombre: "Estética" };
const DEPI = { id: "a-depi", nombre: "Depilación Definitiva" };
const CAPA = { id: "a-cap", nombre: "Capacitaciones" };

function item(p: Partial<ItemDeCatalogo> & Pick<ItemDeCatalogo, "origen" | "id" | "nombre">): ItemDeCatalogo {
  return { packSesiones: null, packDescuentoPct: null, precioDesde: 1000, descripcion: null, desglose: [], area: null, ...p };
}

const LIMPIEZA = item({ origen: "servicio", id: "s1", nombre: "Limpieza facial", area: ESTETICA });
const SUELTO = item({ origen: "servicio", id: "s2", nombre: "Servicio huérfano", area: null });
const COMBO = item({ origen: "combo", id: "c1", nombre: "Combo Glow", area: ESTETICA });
const PACK = item({ origen: "combo", id: "c2", nombre: "Pack 3 limpiezas", area: ESTETICA, packSesiones: 3 });
const PIERNAS = item({ origen: "depilacion", id: "d1", nombre: "Piernas", area: DEPI, packSesiones: 6 });
const CURSO = item({ origen: "capacitacion", id: "t1", nombre: "Curso lifting", area: CAPA });

const DESCUENTO: PromoVendible = {
  id: "p1", name: "Octubre 20%", discountPercentage: 20, discountAmount: null, promotionType: "descuento",
  precioDelPaquete: null, destinos: [{ tipo: "servicio", id: "s1", cantidad: 1 }, { tipo: "combo", id: "c1", cantidad: 1 }],
};
const PAQUETE: PromoVendible = {
  id: "p2", name: "Día de spa", discountPercentage: null, discountAmount: null, promotionType: "paquete",
  precioDelPaquete: 50000, destinos: [{ tipo: "servicio", id: "s1", cantidad: 1 }],
};

const CATALOGO: Catalogo = {
  servicios: [LIMPIEZA, SUELTO],
  combos: [COMBO, PACK],
  depilacion: [PIERNAS],
  capacitaciones: [CURSO],
  promociones: [DESCUENTO, PAQUETE],
};

describe("areasParaVender", () => {
  it("lista las áreas con algo para vender, por nombre, con Sin área y Promos al final", () => {
    expect(areasParaVender(CATALOGO)).toEqual([
      { clave: "a-depi", nombre: "Depilación Definitiva" },
      { clave: "a-est", nombre: "Estética" },
      { clave: CLAVE_SIN_AREA, nombre: "Sin área" },
      { clave: CLAVE_PROMOS, nombre: "Promos" },
    ]);
  });

  it("no ofrece Capacitaciones (etapa 2): se excluye por origen, no por nombre", () => {
    expect(areasParaVender(CATALOGO).map((a) => a.nombre)).not.toContain("Capacitaciones");
  });

  it("sin promos ni items sin área, no muestra esas dos opciones", () => {
    const c = { ...CATALOGO, servicios: [LIMPIEZA], promociones: [] };
    expect(areasParaVender(c).map((a) => a.clave)).toEqual(["a-depi", "a-est"]);
  });
});

describe("itemsDelArea", () => {
  it("agrupa lo del área en Servicios, Combos y Packs, sin grupos vacíos", () => {
    expect(itemsDelArea(CATALOGO, "a-est")).toEqual([
      { titulo: "Servicios", items: [LIMPIEZA] },
      { titulo: "Combos", items: [COMBO] },
      { titulo: "Packs", items: [PACK] },
    ]);
  });

  it("depilación va en su propio grupo", () => {
    expect(itemsDelArea(CATALOGO, "a-depi")).toEqual([{ titulo: "Depilación", items: [PIERNAS] }]);
  });

  it("Sin área junta los items con area null", () => {
    expect(itemsDelArea(CATALOGO, CLAVE_SIN_AREA)).toEqual([{ titulo: "Servicios", items: [SUELTO] }]);
  });

  it("filtra por nombre sin importar mayúsculas", () => {
    expect(itemsDelArea(CATALOGO, "a-est", "GLOW")).toEqual([{ titulo: "Combos", items: [COMBO] }]);
  });
});

describe("sesionesEditables — copia de SESIONES_FIJAS_EN_UNO del CRM", () => {
  it("servicio y depilación sí; combo, pack y capacitación no", () => {
    expect([LIMPIEZA, PIERNAS, COMBO, PACK, CURSO].map(sesionesEditables)).toEqual([true, true, false, false, false]);
  });
});

describe("promos", () => {
  it("promosQueAplican ofrece sólo descuentos cuyo destino es lo elegido", () => {
    expect(promosQueAplican(CATALOGO.promociones, LIMPIEZA)).toEqual([DESCUENTO]);
    expect(promosQueAplican(CATALOGO.promociones, PIERNAS)).toEqual([]);
    expect(promosQueAplican(CATALOGO.promociones, null)).toEqual([]);
  });

  it("itemsDeUnaPromo resuelve los destinos contra el catálogo", () => {
    expect(itemsDeUnaPromo(DESCUENTO, CATALOGO)).toEqual([LIMPIEZA, COMBO]);
  });
});

describe("pedidoDeCotizacion", () => {
  it("sin clienta, no hay pedido", () => {
    expect(pedidoDeCotizacion({ customerId: null, paquete: null, item: LIMPIEZA, sesiones: 1, promotionId: null })).toBeNull();
  });

  it("un paquete se cotiza por la promo", () => {
    expect(pedidoDeCotizacion({ customerId: "cu1", paquete: PAQUETE, item: null, sesiones: 1, promotionId: null })).toEqual({
      origen: "paquete", promotionId: "p2", customerId: "cu1",
    });
  });

  it("un combo se cotiza siempre con 1 sesión aunque haya otra en pantalla", () => {
    expect(pedidoDeCotizacion({ customerId: "cu1", paquete: null, item: COMBO, sesiones: 4, promotionId: "p1" })).toEqual({
      origen: "combo", id: "c1", sessions: 1, promotionId: "p1", customerId: "cu1",
    });
  });

  it("un servicio lleva las sesiones elegidas", () => {
    expect(pedidoDeCotizacion({ customerId: "cu1", paquete: null, item: LIMPIEZA, sesiones: 3, promotionId: null })).toEqual({
      origen: "servicio", id: "s1", sessions: 3, promotionId: null, customerId: "cu1",
    });
  });
});

describe("helpers", () => {
  it("saldoQueEntra nunca pasa el precio ni el saldo", () => {
    expect(saldoQueEntra(166000, 200000)).toBe(166000);
    expect(saldoQueEntra(166000, 20000)).toBe(20000);
    expect(saldoQueEntra(166000, -5)).toBe(0);
  });

  it("pesos sin centavos", () => {
    expect(pesos(166000)).toBe(`$${(166000).toLocaleString("es-AR")}`);
  });

  it("minutosDe pasa HH:MM a minutos desde medianoche", () => {
    expect(minutosDe("15:30")).toBe(930);
  });
});
