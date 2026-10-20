import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

/**
 * Vender desde la agenda (spec 2026-10-16). Son las MISMAS rutas que usa la
 * ficha del CRM (`front-crm/src/api/compras.ts`): la plata se calcula en un
 * solo lugar, la API. Los tipos son copia de los del CRM —los dos repos no
 * comparten paquete— más el `area` de cada item.
 *
 * Va en un módulo aparte de `./agenda` a propósito: los tests existentes
 * mockean `../../api/agenda` entero, y sumar hooks ahí los obligaría a
 * cambiar.
 */

export type OrigenVenta = "combo" | "depilacion" | "servicio" | "capacitacion";
export type AreaDeItem = { id: string; nombre: string } | null;
export type FilaDeDesglose = { nombre: string; cantidad: number };

export type ItemDeCatalogo = {
  origen: OrigenVenta;
  id: string;
  nombre: string;
  packSesiones: number | null;
  packDescuentoPct: number | null;
  precioDesde: number;
  descripcion: string | null;
  desglose: FilaDeDesglose[];
  area: AreaDeItem;
};

export type DestinoDePromo = { tipo: "servicio" | "combo" | "depilacion"; id: string; cantidad: number };

export type PromoVendible = {
  id: string;
  name: string | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  /** `"paquete"` se vende entera; cualquier otro valor es un descuento. */
  promotionType: string | null;
  precioDelPaquete: number | null;
  destinos: DestinoDePromo[];
};

export type Catalogo = {
  combos: ItemDeCatalogo[];
  depilacion: ItemDeCatalogo[];
  servicios: ItemDeCatalogo[];
  capacitaciones: ItemDeCatalogo[];
  promociones: PromoVendible[];
};

/** Lo que devuelve cotizar. Va TAL CUAL al POST de venta: lo que se congela
 *  es lo que Laura vio en pantalla. */
export type Cotizacion = {
  description: string;
  sessionsTotal: number;
  baseAmount: number;
  discountedAmount: number;
  finalAmount: number;
  promotionId: string | null;
  expiresAt: string | null;
  comboId: string | null;
  depilationComboId: string | null;
  serviceId: string | null;
  trainingId: string | null;
  esPaquete?: boolean;
};

export type PedidoDeCotizacion =
  | { origen: OrigenVenta; id: string; sessions: number; promotionId?: string | null; customerId: string }
  | { origen: "paquete"; promotionId: string; customerId: string };

export type EstadoSesion = "consumida" | "perdida" | "agendada" | "vencida" | "disponible";

/** Una línea de una compra (`customer_purchase_service`). Una línea de
 *  depilación tiene `serviceId` NULL y `depilationComboId` cargado; una de
 *  capacitación tiene los dos en NULL. */
export type LineaDeCompra = {
  id: string;
  serviceId: string | null;
  depilationComboId: string | null;
  serviceName: string | null;
  /** Número de vuelta (1, 2, 3…); null en compras viejas. */
  repeticion?: number | null;
  estado: EstadoSesion;
};

/** Lo que la agenda necesita de una compra (la API devuelve más campos). */
export type Compra = {
  id: string;
  description: string | null;
  /** Lo que la API manda además; opcionales para no obligar a los fixtures viejos. */
  comboId?: string | null;
  depilationComboId?: string | null;
  serviceId?: string | null;
  promotionId?: string | null;
  sessionsTotal?: number;
  /** ISO; null = no vence. */
  expiresAt?: string | null;
  /** ISO; no-null = compra cancelada. */
  cancelledAt?: string | null;
  saldo: number;
  servicios: LineaDeCompra[];
};

export type MedioDePago = "cash" | "bank_transfer" | "mercadopago" | "debit_card" | "credit_card";

/** Cuánto falta cobrar y el mínimo de ahora. Lo calcula la API (regla 5.10). */
export type EstadoDeCobro = { pendiente: number; minimo: number; sugerido: number; faltaElMinimo: boolean };

export function fetchCatalogoVendible(): Promise<Catalogo> {
  return api<Catalogo>("/api/crm/purchases/catalog");
}

export function cotizarVenta(pedido: PedidoDeCotizacion): Promise<Cotizacion> {
  return api<Cotizacion>("/api/crm/purchases/quote", { method: "POST", body: JSON.stringify(pedido) });
}

export function venderCompra(
  input: Cotizacion & { customerId: string; usarSaldo?: number },
): Promise<{ id: string; pagadoConSaldo?: number }> {
  return api("/api/crm/purchases", { method: "POST", body: JSON.stringify(input) });
}

export function fetchComprasDeCliente(customerId: string): Promise<Compra[]> {
  return api<Compra[]>(`/api/crm/customers/${customerId}/purchases`);
}

export function fetchEstadoDeCobro(compraId: string): Promise<EstadoDeCobro> {
  return api<EstadoDeCobro>(`/api/crm/purchases/${compraId}/checkout-state`);
}

export function cobrarCompra(
  id: string,
  input: { amount: number; method: MedioDePago; wantsInvoice: boolean },
): Promise<EstadoDeCobro> {
  return api<EstadoDeCobro>(`/api/crm/purchases/${id}/checkout`, { method: "POST", body: JSON.stringify(input) });
}

/** `staleTime: 0`, igual que en el CRM: el catálogo se edita en el dashboard
 *  y la agenda no se entera; se pinta lo guardado y se pide lo nuevo atrás. */
export function useCatalogoVendible() {
  return useQuery({ queryKey: ["ventas", "catalogo"], queryFn: fetchCatalogoVendible, staleTime: 0 });
}

/** Query y no mutación: al cambiar sesiones o promo el precio se actualiza
 *  solo. `null` = todavía falta elegir algo. */
export function useCotizacion(pedido: PedidoDeCotizacion | null) {
  return useQuery({
    queryKey: ["ventas", "cotizacion", pedido],
    queryFn: () => cotizarVenta(pedido!),
    enabled: pedido !== null,
    retry: false,
  });
}

/**
 * Lo que queda viejo en la AGENDA cuando se vende o se cobra: lo que la
 * clienta tiene a favor (`consumible`) y la puerta de pago de depilación
 * (`para-agendar`). Sin esto, la solapa Agendar no vería la compra nueva.
 */
function invalidarLoQueAgendaLee(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["consumible"] });
  qc.invalidateQueries({ queryKey: ["para-agendar"] });
  qc.invalidateQueries({ queryKey: ["ventas", "compras"] });
}

export function useVender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: venderCompra,
    onSuccess: () => invalidarLoQueAgendaLee(qc),
  });
}

/** `staleTime: 0`: proponer un número viejo haría cobrar de más. */
export function useEstadoDeCobro(compraId: string | null) {
  return useQuery({
    queryKey: ["ventas", "cobro", compraId],
    queryFn: () => fetchEstadoDeCobro(compraId!),
    enabled: !!compraId,
    staleTime: 0,
  });
}

export function useCobrarCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; amount: number; method: MedioDePago; wantsInvoice: boolean }) =>
      cobrarCompra(input.id, { amount: input.amount, method: input.method, wantsInvoice: input.wantsInvoice }),
    onSuccess: () => invalidarLoQueAgendaLee(qc),
  });
}

/** Una compra de la clienta, leída con la misma ruta que la ficha del CRM. */
export function useCompraDeCliente(customerId: string | null, compraId: string | null) {
  return useQuery({
    queryKey: ["ventas", "compras", customerId],
    queryFn: () => fetchComprasDeCliente(customerId!),
    enabled: !!customerId && !!compraId,
    staleTime: 0,
    select: (compras) => compras.find((c) => c.id === compraId) ?? null,
  });
}
