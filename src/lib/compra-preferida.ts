import type { Consumible } from "../api/agenda";

/**
 * Qué servicio comprado arranca elegido en "Agendar".
 *
 * Igual que hoy, salvo un caso: si la clienta tiene VARIAS compras para el
 * servicio y una es la que se acaba de vender desde la agenda
 * (`compraPreferidaId`), arranca elegida esa (Pia, 2026-10-16). Laura la
 * puede cambiar. Sin preferida, nada cambia.
 */
export function compraInicial(consumible: Consumible | undefined, compraPreferidaId: string | null): string | null {
  if (consumible?.tipo === "automatica") return consumible.purchaseServiceId;
  if (consumible?.tipo === "elige_laura" && compraPreferidaId) {
    return consumible.opciones.find((o) => o.purchaseId === compraPreferidaId)?.purchaseServiceId ?? null;
  }
  return null;
}
