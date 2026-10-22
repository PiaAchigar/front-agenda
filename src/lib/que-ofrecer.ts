import type { Catalogo, Compra, ItemDeCatalogo, LineaDeCompra, PromoVendible } from "../api/ventas";
import { areasParaVender, CLAVE_PROMOS, CLAVE_SIN_AREA, itemsDelArea, type OpcionDeArea } from "./vender";

/**
 * Qué se ofrece en el "Nuevo turno" (spec 2026-10-19 agenda individual).
 * Lógica pura: arma listas y decide si se agenda o se vende. La plata la
 * resuelve la API al cotizar y al vender.
 */

/** Áreas que NO se agendan con un hueco de la grilla. */
const AREAS_FUERA = new Set(["actividades", "capacitaciones"]);

export type LineaDisponible = {
  compraId: string;
  purchaseServiceId: string;
  texto: string;
  esDepilacion: boolean;
  serviceId: string | null;
  venceEl: string | null;
};

export type EleccionDeQue =
  | { tipo: "comprado"; linea: LineaDisponible }
  | { tipo: "servicio" | "combo" | "pack" | "depilacion" | "capacitacion"; item: ItemDeCatalogo }
  | { tipo: "promo"; promo: PromoVendible };

export type GrupoDeQue = {
  titulo: "Ya comprado" | "Servicios" | "Combos" | "Packs" | "Promos";
  opciones: EleccionDeQue[];
};

/**
 * Lo que ofrece la prestadora del hueco (`GET /providers/:id/oferta`). Con
 * ella, el Nuevo turno muestra sólo lo suyo (pedido de Pia, 2026-10-22).
 */
export type OfertaDeProveedora = {
  servicios: string[];
  /** Combos y packs con al menos un servicio suyo */
  combos: string[];
  depilacion: boolean;
  actividades: { id: string; nombre: string }[];
  capacitaciones: { id: string; nombre: string }[];
};

/**
 * Las áreas de lo que dicta en Turnos grupales. No se agendan en un hueco: se
 * muestran para que Laura vea lo que ofrece y salte a anotarla allá.
 */
export const CLAVE_ACTIVIDADES_QUE_DICTA = "dicta-actividades";
export const CLAVE_CAPACITACIONES_QUE_DICTA = "dicta-capacitaciones";

/**
 * Las áreas del select del Nuevo turno: sin Actividades ni Capacitaciones del
 * catálogo; Promos al final. Con la oferta de una prestadora, al final van las
 * actividades y capacitaciones que dicta.
 */
export function areasDelTurno(catalogo: Catalogo, oferta?: OfertaDeProveedora | null): OpcionDeArea[] {
  const areas = areasParaVender(catalogo).filter((a) => !AREAS_FUERA.has(a.nombre.trim().toLowerCase()));
  if (oferta?.actividades.length) areas.push({ clave: CLAVE_ACTIVIDADES_QUE_DICTA, nombre: "Actividades que dicta" });
  if (oferta?.capacitaciones.length) areas.push({ clave: CLAVE_CAPACITACIONES_QUE_DICTA, nombre: "Capacitaciones que dicta" });
  return areas;
}

/** El catálogo recortado a lo que hace la prestadora: sus servicios, combos y packs, depilación si la hace, y las promos de eso. */
export function catalogoDeLaPrestadora(catalogo: Catalogo, oferta: OfertaDeProveedora): Catalogo {
  const servicios = catalogo.servicios.filter((i) => oferta.servicios.includes(i.id));
  const combos = catalogo.combos.filter((i) => oferta.combos.includes(i.id));
  const depilacion = oferta.depilacion ? catalogo.depilacion : [];
  const listas = { servicio: servicios, combo: combos, depilacion };
  const promociones = catalogo.promociones.filter((p) =>
    p.destinos.some((d) => listas[d.tipo].some((i) => i.id === d.id)),
  );
  return { ...catalogo, servicios, combos, depilacion, promociones };
}

/** Las compras con sólo las sesiones que la prestadora puede hacer (para "Ya comprado"). */
export function comprasQueHace(compras: Compra[], oferta: OfertaDeProveedora): Compra[] {
  return compras.map((c) => ({
    ...c,
    servicios: c.servicios.filter((s) =>
      s.depilationComboId != null ? oferta.depilacion : s.serviceId != null && oferta.servicios.includes(s.serviceId),
    ),
  }));
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function estaViva(c: Compra, ahora: Date): boolean {
  if (c.cancelledAt) return false;
  return !c.expiresAt || new Date(c.expiresAt).getTime() > ahora.getTime();
}

/** Las sesiones sin usar de las compras vivas, en el orden en que `consumible` las usaría: lo que vence antes primero. */
function lineasDisponibles(compras: Compra[], ahora: Date): { linea: LineaDisponible; compra: Compra }[] {
  const filas = compras.filter((c) => estaViva(c, ahora)).flatMap((compra) =>
    compra.servicios
      .filter((s) => s.estado === "disponible")
      .map((s) => ({ linea: aLinea(compra, s), compra })),
  );
  // Sort estable: a igual vencimiento queda el orden de la API.
  return filas.sort((a, b) => {
    const va = a.linea.venceEl ? new Date(a.linea.venceEl).getTime() : Infinity;
    const vb = b.linea.venceEl ? new Date(b.linea.venceEl).getTime() : Infinity;
    return va - vb;
  });
}

function aLinea(compra: Compra, s: LineaDeCompra): LineaDisponible {
  const base = compra.description ?? s.serviceName ?? "Compra";
  const sesion =
    s.repeticion != null
      ? ` · sesión ${s.repeticion}${compra.sessionsTotal != null ? ` de ${compra.sessionsTotal}` : ""}`
      : "";
  return {
    compraId: compra.id,
    purchaseServiceId: s.id,
    texto: base + sesion,
    esDepilacion: s.depilationComboId != null,
    serviceId: s.serviceId,
    venceEl: compra.expiresAt ?? null,
  };
}

/** El área de una línea comprada: la de su servicio / pack de depilación; si no, la del combo. */
function areaDeLaLinea(catalogo: Catalogo, compra: Compra, s: LineaDeCompra): ItemDeCatalogo["area"] | undefined {
  const buscar = (lista: ItemDeCatalogo[], id: string | null | undefined) =>
    id ? lista.find((i) => i.id === id) : undefined;
  const item =
    buscar(catalogo.depilacion, s.depilationComboId) ??
    buscar(catalogo.servicios, s.serviceId) ??
    buscar(catalogo.combos, compra.comboId) ??
    buscar(catalogo.depilacion, compra.depilationComboId) ??
    buscar(catalogo.servicios, compra.serviceId);
  return item?.area;
}

function enArea(area: ItemDeCatalogo["area"] | undefined, clave: string): boolean {
  if (area === undefined) return false;
  return clave === CLAVE_SIN_AREA ? area === null : area?.id === clave;
}

/**
 * Lo que se ofrece en un área: "Ya comprado" primero y después lo del catálogo.
 * `ahora` sólo se inyecta para los tests.
 */
export function gruposDeQue(
  catalogo: Catalogo,
  compras: Compra[] | null,
  area: string,
  busqueda: string,
  ahora: Date = new Date(),
): GrupoDeQue[] {
  const q = sinTildes(busqueda.trim());
  const coincide = (texto: string | null | undefined) => !q || sinTildes(texto ?? "").includes(q);
  const grupos: GrupoDeQue[] = [];

  // Ya comprado: las sesiones sin usar de compras vivas, del área.
  if (compras && area !== CLAVE_PROMOS) {
    const opciones = lineasDisponibles(compras, ahora)
      .filter(({ linea, compra }) => {
        const s = compra.servicios.find((x) => x.id === linea.purchaseServiceId)!;
        return enArea(areaDeLaLinea(catalogo, compra, s), area) && coincide(`${linea.texto} ${s.serviceName ?? ""}`);
      })
      .map(({ linea }): EleccionDeQue => ({ tipo: "comprado", linea }));
    if (opciones.length > 0) grupos.push({ titulo: "Ya comprado", opciones });
  }

  // Lo del catálogo. El área Promos no tiene items propios, sólo promos.
  const delArea = area === CLAVE_PROMOS ? [] : itemsDelArea(catalogo, area, busqueda);
  const deGrupo = (titulo: string) => delArea.find((g) => g.titulo === titulo)?.items ?? [];
  const pack = (i: ItemDeCatalogo): EleccionDeQue => ({
    tipo: i.origen === "depilacion" ? "depilacion" : i.packSesiones !== null ? "pack" : "combo",
    item: i,
  });
  const deDepilacion = deGrupo("Depilación");

  const servicios = deGrupo("Servicios").filter((i) => i.origen !== "capacitacion");
  if (servicios.length) grupos.push({ titulo: "Servicios", opciones: servicios.map((item) => ({ tipo: "servicio", item })) });

  const combos = [...deGrupo("Combos").map(pack), ...deDepilacion.filter((i) => i.packSesiones === null).map(pack)];
  if (combos.length) grupos.push({ titulo: "Combos", opciones: combos });

  const packs = [...deGrupo("Packs").map(pack), ...deDepilacion.filter((i) => i.packSesiones !== null).map(pack)];
  if (packs.length) grupos.push({ titulo: "Packs", opciones: packs });

  const promos = catalogo.promociones
    .filter((p) => area === CLAVE_PROMOS || p.destinos.some((d) => delAreaTiene(catalogo, area, d.tipo, d.id)))
    .filter((p) => coincide(p.name));
  if (promos.length) grupos.push({ titulo: "Promos", opciones: promos.map((promo) => ({ tipo: "promo", promo })) });

  return grupos;
}

/** ¿El destino de una promo es un item de esta área? (sin filtrar por búsqueda) */
function delAreaTiene(catalogo: Catalogo, area: string, tipo: "servicio" | "combo" | "depilacion", id: string): boolean {
  const listas = { servicio: catalogo.servicios, combo: catalogo.combos, depilacion: catalogo.depilacion };
  const item = listas[tipo].find((i) => i.id === id);
  return !!item && item.origen !== "capacitacion" && enArea(item.area, area);
}

/** Agendar un hueco, o pasar primero por la venta. */
export function modoDelTurno(e: EleccionDeQue, cuando: "ahora" | "en-el-turno"): "agendar" | "vender" {
  if (e.tipo === "comprado") return "agendar";
  if (e.tipo === "servicio" && cuando === "en-el-turno") return "agendar";
  return "vender";
}

/** Las sesiones sin usar que la clienta ya tiene de lo mismo que se va a vender. */
export function sinUsarDeLoMismo(e: EleccionDeQue, compras: Compra[], ahora: Date = new Date()): LineaDisponible[] {
  if (e.tipo === "comprado" || e.tipo === "promo") return [];
  const { item } = e;
  const mismo = (c: Compra) =>
    e.tipo === "servicio"
      ? c.serviceId === item.id
      : e.tipo === "depilacion"
        ? c.depilationComboId === item.id
        : c.comboId === item.id;
  return lineasDisponibles(compras.filter(mismo), ahora).map((f) => f.linea);
}

/**
 * Lo que hay en un Área, como lo pregunta `GET /providers/quien-hace-en`: con
 * un Área elegida y sin Qué todavía, Prestadora lista a las que hacen algo de
 * ahí. Promos (se cruza con todas las áreas) y lo que dicta en grupales: null.
 */
export function loDelArea(
  catalogo: Catalogo,
  area: string,
): { servicios: string[]; combos: string[]; depilacion: boolean } | null {
  if (!area || area === CLAVE_PROMOS || area === CLAVE_ACTIVIDADES_QUE_DICTA || area === CLAVE_CAPACITACIONES_QUE_DICTA) {
    return null;
  }
  const del = (lista: ItemDeCatalogo[]) => lista.filter((i) => enArea(i.area, area));
  return {
    servicios: del(catalogo.servicios).filter((i) => i.origen !== "capacitacion").map((i) => i.id),
    combos: del(catalogo.combos).map((i) => i.id),
    depilacion: del(catalogo.depilacion).length > 0,
  };
}

