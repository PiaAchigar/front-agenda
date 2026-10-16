import type { Compra } from "../api/ventas";
import type { NewApptPrefill } from "../features/day-view/NewAppointmentModal";

/**
 * "¿Qué va en este turno?" (spec 2026-10-16, decisión 7): una compra puede
 * traer varias cosas y el hueco es UN turno. Laura elige; lo demás queda
 * "A agendar" en la ficha.
 */

export type OpcionParaElTurno = {
  /** `serviceId`, o `depi:<depilationComboId>` en depilación. */
  clave: string;
  nombre: string;
  /** La primera línea libre de esa opción: la que se va a descontar. */
  purchaseServiceId: string;
  serviceId: string | null;
  esDepilacion: boolean;
};

export type Hueco = { providerId?: string; providerName?: string; minutes?: number };

/** Una opción por servicio distinto con alguna línea "disponible". Una
 *  línea de capacitación (sin servicio ni pack de depilación) no va en un
 *  turno de agenda. */
export function opcionesParaElTurno(compra: Pick<Compra, "servicios" | "description">): OpcionParaElTurno[] {
  const vistas = new Map<string, OpcionParaElTurno>();
  for (const l of compra.servicios) {
    if (l.estado !== "disponible") continue;
    const clave = l.serviceId ?? (l.depilationComboId ? `depi:${l.depilationComboId}` : null);
    if (!clave || vistas.has(clave)) continue;
    vistas.set(clave, {
      clave,
      nombre: l.serviceName ?? compra.description ?? "Sesión",
      purchaseServiceId: l.id,
      serviceId: l.serviceId,
      esDepilacion: l.serviceId === null,
    });
  }
  return [...vistas.values()];
}

/** Si la profesional del hueco hace esto. Sin profesional fija, cualquiera.
 *  Depilación siempre: la habilitación sobre el ancla la valida la API. */
export function laHace(opcion: OpcionParaElTurno, serviciosDeLaProfesional: string[] | null): boolean {
  if (serviciosDeLaProfesional === null || opcion.esDepilacion) return true;
  return serviciosDeLaProfesional.includes(opcion.serviceId!);
}

/** Qué arranca elegido: la única opción, o la única que hace la profesional. */
export function preseleccion(opciones: OpcionParaElTurno[], serviciosDeLaProfesional: string[] | null): string | null {
  if (opciones.length === 1) return opciones[0]!.clave;
  if (serviciosDeLaProfesional === null) return null;
  const suyas = opciones.filter((o) => laHace(o, serviciosDeLaProfesional));
  return suyas.length === 1 ? suyas[0]!.clave : null;
}

/**
 * Lo que recibe la solapa "Agendar". Depilación va por `purchaseServiceId`
 * (el mismo camino que "A agendar" desde el CRM); el resto por `serviceId` +
 * la compra recién vendida como preferida. La profesional del hueco sólo se
 * fija si hace el servicio: fijar una que no lo ofrece dejaría el select de
 * servicios vacío.
 */
export function prefillDeTraspaso(a: {
  opcion: OpcionParaElTurno;
  compraId: string;
  customerId: string;
  hueco: Hueco;
  serviciosDeLaProfesional: string[] | null;
}): NewApptPrefill {
  const profesional =
    a.hueco.providerId && laHace(a.opcion, a.serviciosDeLaProfesional)
      ? { providerId: a.hueco.providerId, providerName: a.hueco.providerName }
      : {};
  if (a.opcion.esDepilacion) {
    return { customerId: a.customerId, purchaseServiceId: a.opcion.purchaseServiceId, minutes: a.hueco.minutes, ...profesional };
  }
  return {
    customerId: a.customerId,
    serviceId: a.opcion.serviceId!,
    compraPreferidaId: a.compraId,
    minutes: a.hueco.minutes,
    ...profesional,
  };
}
