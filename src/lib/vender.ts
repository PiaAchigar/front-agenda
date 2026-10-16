import type { Catalogo, ItemDeCatalogo, PedidoDeCotizacion, PromoVendible } from "../api/ventas";

/**
 * Lógica pura de "Vender y agendar" (spec 2026-10-16). Nada de esto decide
 * un monto: arma listas y pedidos. Lo que cuesta, el mínimo y si una promo
 * aplica de verdad lo resuelve la API al cotizar y al vender.
 */

export const CLAVE_SIN_AREA = "sin-area";
export const CLAVE_PROMOS = "promos";

export type OpcionDeArea = { clave: string; nombre: string };
export type GrupoDeItems = { titulo: string; items: ItemDeCatalogo[] };

/**
 * Las áreas del select. Sale del catálogo y no de una lista fija: sólo se
 * ofrece un área si tiene algo para vender. Las capacitaciones quedan afuera
 * en la etapa 1 por su ORIGEN (se agendan contra un encuentro fechado, no
 * contra un hueco), no por el nombre del área.
 */
export function areasParaVender(catalogo: Catalogo): OpcionDeArea[] {
  const porId = new Map<string, string>();
  let haySinArea = false;
  for (const i of [...catalogo.servicios, ...catalogo.combos, ...catalogo.depilacion]) {
    if (i.area) porId.set(i.area.id, i.area.nombre);
    else haySinArea = true;
  }
  const areas = [...porId]
    .map(([clave, nombre]) => ({ clave, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (haySinArea) areas.push({ clave: CLAVE_SIN_AREA, nombre: "Sin área" });
  if (catalogo.promociones.length > 0) areas.push({ clave: CLAVE_PROMOS, nombre: "Promos" });
  return areas;
}

/** Lo de un área, agrupado como lo piensa Laura. Sin grupos vacíos. */
export function itemsDelArea(catalogo: Catalogo, claveArea: string, busqueda = ""): GrupoDeItems[] {
  const enArea = (i: ItemDeCatalogo) =>
    claveArea === CLAVE_SIN_AREA ? i.area === null : i.area?.id === claveArea;
  const q = busqueda.trim().toLowerCase();
  const filtrar = (lista: ItemDeCatalogo[]) =>
    lista.filter(enArea).filter((i) => !q || i.nombre.toLowerCase().includes(q));
  const combos = filtrar(catalogo.combos);
  return [
    { titulo: "Servicios", items: filtrar(catalogo.servicios) },
    // Un pack ES una fila de `combos`: lo distingue tener sesiones de pack.
    { titulo: "Combos", items: combos.filter((c) => c.packSesiones === null) },
    { titulo: "Packs", items: combos.filter((c) => c.packSesiones !== null) },
    { titulo: "Depilación", items: filtrar(catalogo.depilacion) },
  ].filter((g) => g.items.length > 0);
}

/**
 * Si se pueden elegir las sesiones. Copia de `SESIONES_FIJAS_EN_UNO` en
 * `front-crm/src/features/compras/VenderModal.tsx`: un combo o pack ya trae
 * sus sesiones adentro, y una capacitación se vende entera.
 */
export function sesionesEditables(item: ItemDeCatalogo): boolean {
  return item.origen === "servicio" || item.origen === "depilacion";
}

/** Copia de `front-crm/src/lib/promos-para-vender.ts`. */
export function esPaquete(promo: { promotionType?: string | null }): boolean {
  return promo.promotionType === "paquete";
}

/**
 * Los descuentos que sirven para lo elegido. Copia de
 * `front-crm/src/lib/promo-aplica.ts` (que a su vez copia la API). Sólo
 * filtra un desplegable: si las copias se separan, el peor caso es ofrecer
 * de más y que la API rechace al cotizar, nunca vender a otro precio.
 */
export function promosQueAplican(promos: PromoVendible[], item: ItemDeCatalogo | null): PromoVendible[] {
  if (!item || item.origen === "capacitacion") return [];
  return promos.filter(
    (p) => !esPaquete(p) && p.destinos.some((d) => d.tipo === item.origen && d.id === item.id),
  );
}

/** Los items del catálogo a los que apunta una promo, en su orden. */
export function itemsDeUnaPromo(promo: PromoVendible, catalogo: Catalogo): ItemDeCatalogo[] {
  const listas = { servicio: catalogo.servicios, combo: catalogo.combos, depilacion: catalogo.depilacion };
  return promo.destinos
    .map((d) => listas[d.tipo].find((i) => i.id === d.id))
    .filter((i): i is ItemDeCatalogo => i !== undefined);
}

/** Qué se le pide cotizar a la API. `null` = todavía falta elegir algo. */
export function pedidoDeCotizacion(e: {
  customerId: string | null;
  paquete: PromoVendible | null;
  item: ItemDeCatalogo | null;
  sesiones: number;
  promotionId: string | null;
}): PedidoDeCotizacion | null {
  if (!e.customerId) return null;
  if (e.paquete) return { origen: "paquete", promotionId: e.paquete.id, customerId: e.customerId };
  if (!e.item) return null;
  return {
    origen: e.item.origen,
    id: e.item.id,
    sessions: sesionesEditables(e.item) ? Math.max(1, e.sesiones) : 1,
    promotionId: e.promotionId,
    customerId: e.customerId,
  };
}

/** Copia de `front-crm/src/lib/compras-ui.ts`: sólo para MOSTRAR cuánto saldo
 *  entra. La API vuelve a hacer la cuenta al vender. */
export function saldoQueEntra(precio: number, saldo: number): number {
  return Math.min(Math.max(0, saldo), Math.max(0, precio));
}

/** Copia de `front-crm/src/lib/compras-ui.ts`. Sin centavos. */
export function pesos(monto: number): string {
  return `$${Math.round(monto).toLocaleString("es-AR")}`;
}

/** "15:30" → 930. */
export function minutosDe(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Valor de un `<option>` de item: el id solo no alcanza, se repite entre orígenes. */
export function claveDeItem(item: ItemDeCatalogo): string {
  return `${item.origen}:${item.id}`;
}
