/**
 * Lo que falta cobrar de la compra de un turno, para mostrarlo en la agenda.
 *
 * Es la deuda de la compra ENTERA (no la parte del turno): la API la calcula y
 * acá no se hace ninguna cuenta. Lo único que se decide es cuándo se muestra:
 * si no hay deuda (sin compra, compra paga, dato ausente) o el turno no se va
 * a dar (cancelado, ausente), no hay nada que recordar.
 */
export function debeDelTurno(t: { deudaDeLaCompra?: number | null; status: string | null }): number | null {
  if (t.status === "cancelled" || t.status === "no_show") return null;
  const deuda = t.deudaDeLaCompra;
  return deuda != null && deuda > 0 ? deuda : null;
}
