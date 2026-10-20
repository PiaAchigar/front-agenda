import { describe, expect, it } from "vitest";
import type { Catalogo, Compra, ItemDeCatalogo, LineaDeCompra, PromoVendible } from "../api/ventas";
import { areasDelTurno, gruposDeQue, modoDelTurno, sinUsarDeLoMismo, type EleccionDeQue } from "./que-ofrecer";
import { CLAVE_PROMOS } from "./vender";

const AHORA = new Date("2026-10-19T12:00:00Z");
const EST = { id: "a-est", nombre: "Estética" };
const DEP = { id: "a-dep", nombre: "Depilación" };
const ACT = { id: "a-act", nombre: "Actividades" };
const CAP = { id: "a-cap", nombre: "Capacitaciones" };

function item(origen: ItemDeCatalogo["origen"], id: string, nombre: string, area: ItemDeCatalogo["area"], packSesiones: number | null = null): ItemDeCatalogo {
  return { origen, id, nombre, packSesiones, packDescuentoPct: null, precioDesde: 1000, descripcion: null, desglose: [], area };
}

const limpieza = item("servicio", "s-limp", "Limpieza facial", EST);
const masaje = item("servicio", "s-mas", "Masaje", EST);
const yoga = item("servicio", "s-yoga", "Yoga", ACT);
const comboEst = item("combo", "c-1", "Combo rostro", EST);
const packEst = item("combo", "c-pack", "Pack 3 limpiezas", EST, 3);
const packDep = item("depilacion", "d-pack", "Pack cuerpo full", DEP, 4);
const depSuelto = item("depilacion", "d-1", "Axilas", DEP);
const capa = item("servicio", "s-cap", "Curso", CAP);

const promoDep: PromoVendible = {
  id: "p-dep", name: "Promo depi", discountPercentage: 10, discountAmount: null, promotionType: "descuento",
  precioDelPaquete: null, destinos: [{ tipo: "depilacion", id: "d-1", cantidad: 1 }],
};
const promoEst: PromoVendible = {
  id: "p-est", name: "Promo limpieza", discountPercentage: 10, discountAmount: null, promotionType: "descuento",
  precioDelPaquete: null, destinos: [{ tipo: "servicio", id: "s-limp", cantidad: 1 }],
};

const catalogo: Catalogo = {
  servicios: [limpieza, masaje, yoga, capa],
  combos: [comboEst, packEst],
  depilacion: [packDep, depSuelto],
  capacitaciones: [],
  promociones: [promoDep, promoEst],
};

function linea(id: string, o: Partial<LineaDeCompra> = {}): LineaDeCompra {
  return { id, serviceId: "s-limp", depilationComboId: null, serviceName: "Limpieza facial", repeticion: 1, estado: "disponible", ...o };
}
function compra(id: string, o: Partial<Compra> = {}): Compra {
  return { id, description: "Pack 3 limpiezas", saldo: 0, servicios: [], comboId: "c-pack", sessionsTotal: 3, expiresAt: null, cancelledAt: null, ...o };
}

const packViva = compra("cp-1", {
  servicios: [linea("l1", { repeticion: 1, estado: "consumida" }), linea("l2", { repeticion: 2 }), linea("l3", { repeticion: 3 })],
});

describe("areasDelTurno", () => {
  it("no trae Actividades ni Capacitaciones y termina en Promos", () => {
    const claves = areasDelTurno(catalogo).map((a) => a.nombre);
    expect(claves).not.toContain("Actividades");
    expect(claves).not.toContain("Capacitaciones");
    expect(claves).toEqual(["Depilación", "Estética", "Promos"]);
    expect(areasDelTurno(catalogo).at(-1)?.clave).toBe(CLAVE_PROMOS);
  });
});

describe("gruposDeQue", () => {
  const titulos = (g: ReturnType<typeof gruposDeQue>) => g.map((x) => x.titulo);

  it("Estética: Ya comprado, Servicios, Combos, Packs, Promos", () => {
    const g = gruposDeQue(catalogo, [packViva], EST.id, "", AHORA);
    expect(titulos(g)).toEqual(["Ya comprado", "Servicios", "Combos", "Packs", "Promos"]);
    const comprado = g[0]!.opciones;
    expect(comprado).toHaveLength(2);
    expect(comprado[0]).toMatchObject({ tipo: "comprado", linea: { purchaseServiceId: "l2", texto: "Pack 3 limpiezas · sesión 2 de 3", esDepilacion: false, serviceId: "s-limp" } });
  });

  it("Depilación no tiene Servicios; sus items van en Packs o Combos", () => {
    const g = gruposDeQue(catalogo, null, DEP.id, "", AHORA);
    expect(titulos(g)).toEqual(["Combos", "Packs", "Promos"]);
    expect(g.find((x) => x.titulo === "Packs")!.opciones).toEqual([{ tipo: "depilacion", item: packDep }]);
    expect(g.find((x) => x.titulo === "Combos")!.opciones).toEqual([{ tipo: "depilacion", item: depSuelto }]);
  });

  it("una promo con destino de depilación aparece en Depilación y en Promos", () => {
    const dep = gruposDeQue(catalogo, null, DEP.id, "", AHORA).find((x) => x.titulo === "Promos")!;
    expect(dep.opciones).toEqual([{ tipo: "promo", promo: promoDep }]);
    const todas = gruposDeQue(catalogo, null, CLAVE_PROMOS, "", AHORA);
    expect(titulos(todas)).toEqual(["Promos"]);
    expect(todas[0]!.opciones).toHaveLength(2);
  });

  it("una compra cancelada o vencida no aparece en Ya comprado", () => {
    const cancelada = compra("cp-c", { cancelledAt: "2026-10-01T00:00:00Z", servicios: [linea("x1")] });
    const vencida = compra("cp-v", { expiresAt: "2026-10-18T00:00:00Z", servicios: [linea("x2")] });
    const g = gruposDeQue(catalogo, [cancelada, vencida], EST.id, "", AHORA);
    expect(titulos(g)).not.toContain("Ya comprado");
  });

  it("compras null: sin Ya comprado", () => {
    expect(titulos(gruposDeQue(catalogo, null, EST.id, "", AHORA))).not.toContain("Ya comprado");
  });

  it("ordena Ya comprado por lo que vence antes; sin vencimiento al final", () => {
    const sinVto = compra("cp-s", { servicios: [linea("s1")] });
    const tarde = compra("cp-t", { expiresAt: "2026-12-01T00:00:00Z", servicios: [linea("t1")] });
    const pronto = compra("cp-p", { expiresAt: "2026-11-01T00:00:00Z", servicios: [linea("p1")] });
    const g = gruposDeQue(catalogo, [sinVto, tarde, pronto], EST.id, "", AHORA)[0]!;
    expect(g.opciones.map((o) => (o.tipo === "comprado" ? o.linea.purchaseServiceId : ""))).toEqual(["p1", "t1", "s1"]);
  });

  it("lo comprado de depilación va al área de depilación", () => {
    const c = compra("cp-d", { comboId: null, depilationComboId: "d-pack", description: "Pack cuerpo full", sessionsTotal: 4,
      servicios: [linea("d1", { serviceId: null, depilationComboId: "d-pack", serviceName: null })] });
    expect(titulos(gruposDeQue(catalogo, [c], EST.id, "", AHORA))).not.toContain("Ya comprado");
    const g = gruposDeQue(catalogo, [c], DEP.id, "", AHORA)[0]!;
    expect(g.titulo).toBe("Ya comprado");
    expect(g.opciones[0]).toMatchObject({ linea: { esDepilacion: true, serviceId: null } });
  });

  it("la búsqueda 'limp' filtra", () => {
    const g = gruposDeQue(catalogo, null, EST.id, "limp", AHORA);
    expect(titulos(g)).toEqual(["Servicios", "Packs", "Promos"]);
    expect(g[0]!.opciones).toEqual([{ tipo: "servicio", item: limpieza }]);
    expect(g.find((x) => x.titulo === "Promos")!.opciones).toEqual([{ tipo: "promo", promo: promoEst }]);
  });

  it("la búsqueda también filtra lo ya comprado", () => {
    const g = gruposDeQue(catalogo, [packViva], EST.id, "masaje", AHORA);
    expect(titulos(g)).toEqual(["Servicios"]);
  });
});

describe("modoDelTurno", () => {
  const comprado: EleccionDeQue = { tipo: "comprado", linea: { compraId: "c", purchaseServiceId: "l", texto: "t", esDepilacion: false, serviceId: "s", venceEl: null } };
  const servicio: EleccionDeQue = { tipo: "servicio", item: limpieza };
  const combo: EleccionDeQue = { tipo: "combo", item: comboEst };
  const pack: EleccionDeQue = { tipo: "pack", item: packEst };
  const depi: EleccionDeQue = { tipo: "depilacion", item: packDep };
  const promo: EleccionDeQue = { tipo: "promo", promo: promoEst };

  it("comprado siempre agenda", () => {
    expect(modoDelTurno(comprado, "ahora")).toBe("agendar");
    expect(modoDelTurno(comprado, "en-el-turno")).toBe("agendar");
  });
  it("servicio agenda sólo si se cobra en el turno", () => {
    expect(modoDelTurno(servicio, "en-el-turno")).toBe("agendar");
    expect(modoDelTurno(servicio, "ahora")).toBe("vender");
  });
  it("todo lo demás vende", () => {
    for (const e of [combo, pack, depi, promo]) {
      expect(modoDelTurno(e, "ahora")).toBe("vender");
      expect(modoDelTurno(e, "en-el-turno")).toBe("vender");
    }
  });
});

describe("sinUsarDeLoMismo", () => {
  it("encuentra las 2 sesiones sin usar del mismo pack", () => {
    const r = sinUsarDeLoMismo({ tipo: "pack", item: packEst }, [packViva]);
    expect(r.map((l) => l.purchaseServiceId)).toEqual(["l2", "l3"]);
  });
  it("combo, depilación y servicio se emparejan por su propio id", () => {
    const combo = compra("cp-co", { comboId: "c-1", servicios: [linea("o1")] });
    const depi = compra("cp-de", { comboId: null, depilationComboId: "d-pack", servicios: [linea("o2", { serviceId: null, depilationComboId: "d-pack" })] });
    const serv = compra("cp-se", { comboId: null, serviceId: "s-limp", servicios: [linea("o3")] });
    const todas = [packViva, combo, depi, serv];
    expect(sinUsarDeLoMismo({ tipo: "combo", item: comboEst }, todas).map((l) => l.purchaseServiceId)).toEqual(["o1"]);
    expect(sinUsarDeLoMismo({ tipo: "depilacion", item: packDep }, todas).map((l) => l.purchaseServiceId)).toEqual(["o2"]);
    expect(sinUsarDeLoMismo({ tipo: "servicio", item: limpieza }, todas).map((l) => l.purchaseServiceId)).toEqual(["o3"]);
  });
  it("no cuenta compras canceladas y las promos no tienen 'lo mismo'", () => {
    const cancelada = compra("cp-c", { cancelledAt: "2026-10-01T00:00:00Z", servicios: [linea("x")] });
    expect(sinUsarDeLoMismo({ tipo: "pack", item: packEst }, [cancelada])).toEqual([]);
    expect(sinUsarDeLoMismo({ tipo: "promo", promo: promoEst }, [packViva])).toEqual([]);
  });
});
