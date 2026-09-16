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
