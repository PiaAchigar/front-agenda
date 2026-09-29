/**
 * Qué se puede hacer con un turno desde el modal de la agenda.
 *
 * Lógica pura, sin React ni fetch: es una regla de negocio, no una pantalla.
 */

export type TurnoParaAcciones = {
  status: string | null;
  customerId: string | null;
  /** La fila de `customer_purchase_service` de la que sale el turno, si sale
   *  de una. No nula = la clienta ya compró esto. */
  customerPurchaseServiceId: string | null;
};

/**
 * Si el turno se puede cobrar desde la agenda.
 *
 * **La condición que importa es la última: un turno que sale de una compra NO
 * se cobra acá.** La clienta ya pagó el combo, el pack o el servicio, y
 * "Cobrar" manda a facturación a cobrar el precio del servicio — o sea, se lo
 * cobraría dos veces (Pia, 2026-09-16). Y si la compra quedó con saldo, ese
 * saldo se cobra del lado de la compra, no del turno: cobrarlo acá dejaría un
 * pago suelto que no descuenta la deuda de la compra.
 *
 * Las otras tres son las que ya estaban:
 * - Fuera del dashboard no hay facturación a la que ir.
 * - Sin clienta no hay a quién facturarle.
 * - Un turno cancelado o ausente no se cobra.
 */
export function sePuedeCobrar(turno: TurnoParaAcciones, embebido: boolean): boolean {
  if (!embebido) return false;
  if (!turno.customerId) return false;
  if (turno.status === "cancelled" || turno.status === "no_show") return false;
  return turno.customerPurchaseServiceId == null;
}

/**
 * Si al turno todavía se le puede cambiar el estado.
 *
 * Un turno completado está cerrado: el backend rechaza cualquier transición
 * que salga de ahí (`appointments.service.ts`, "Un turno completado no puede
 * cambiar de estado"). Antes el modal igual ofrecía Ausente, Cancelar turno y
 * Restaurar, y recién al apretarlos aparecía el error en rojo — o sea, tres
 * botones que sólo servían para fallar (Pia, 2026-09-29).
 *
 * No incluye "Cobrar": un turno realizado es justamente el que se factura, y
 * eso no es un cambio de estado.
 */
export function sePuedeCambiarEstado(turno: TurnoParaAcciones): boolean {
  return turno.status !== "completed";
}
