import type { AvailabilitySlot } from "../api/types";
import type { EleccionDeQue } from "./que-ofrecer";

/**
 * El desplegable de Prestadora del Nuevo turno cuando ya hay algo elegido en
 * Qué (spec 2026-10-22-nuevo-turno-filtros-cruzados): sólo las que lo hacen,
 * con qué hace cada una si es un combo, y si está libre a la hora del turno.
 */

/** Lo que devuelve `GET /providers/quien-hace`. */
export type QuienLoHace = {
  providerId: string;
  nombre: string | null;
  hace: string[];
  serviceIds: string[];
  todo: boolean;
};

export type Libertad = { libre: boolean; desde: string | null };

/** Si la prestadora tiene libre ese horario; si no, su próximo horario libre ese día (o null). */
export function libertadEnHora(slots: AvailabilitySlot[], providerId: string, hora: string): Libertad {
  const suyos = slots.filter((s) => s.options.some((o) => o.providerId === providerId)).map((s) => s.start);
  if (suyos.includes(hora)) return { libre: true, desde: null };
  return { libre: false, desde: suyos.filter((h) => h > hora).sort()[0] ?? null };
}

export type GrupoDePrestadoras = { titulo: string | null; opciones: { providerId: string; texto: string }[] };

/**
 * Los grupos del desplegable. Con hora y la libertad de TODAS, por libres y
 * ocupadas; si falta la de alguna, no se agrupa así (mejor no decir nada que
 * decir "libre" sin saberlo). Sin eso, por "hacen todo / una parte" si hay
 * alguna que hace sólo una parte. El orden de adentro es el de la API.
 */
export function gruposDePrestadoras(
  quienes: QuienLoHace[],
  libertad: (q: QuienLoHace) => Libertad | null,
  hora: string | null,
): GrupoDePrestadoras[] {
  if (quienes.length === 0) return [];
  const parte = (q: QuienLoHace) => (q.todo ? "" : ` — sólo ${q.hace.join(", ")}`);
  const nombre = (q: QuienLoHace) => q.nombre ?? "Sin nombre";

  const libertades = quienes.map((q) => [q, libertad(q)] as const);
  if (hora && libertades.every(([, l]) => l !== null)) {
    const libres = libertades.filter(([, l]) => l!.libre);
    const ocupadas = libertades.filter(([, l]) => !l!.libre);
    return [
      { titulo: `Libres a las ${hora}`, opciones: libres.map(([q]) => ({ providerId: q.providerId, texto: nombre(q) + parte(q) })) },
      {
        titulo: "Ocupadas a esa hora",
        opciones: ocupadas.map(([q, l]) => ({
          providerId: q.providerId,
          texto: `${nombre(q)}${parte(q)} · ${l!.desde ? `libre desde ${l!.desde}` : "sin lugar ese día"}`,
        })),
      },
    ].filter((g) => g.opciones.length > 0);
  }

  const opcion = (q: QuienLoHace) => ({ providerId: q.providerId, texto: nombre(q) + parte(q) });
  if (quienes.every((q) => q.todo)) return [{ titulo: null, opciones: quienes.map(opcion) }];
  return [
    { titulo: "Hacen todo", opciones: quienes.filter((q) => q.todo).map(opcion) },
    { titulo: "Hacen una parte", opciones: quienes.filter((q) => !q.todo).map(opcion) },
  ].filter((g) => g.opciones.length > 0);
}

/** Lo elegido en Qué, como lo pregunta `GET /providers/quien-hace`. Una capacitación no se agenda en un hueco: null. */
export type QueSeBusca = { tipo: "servicio" | "combo" | "depilacion" | "promo"; id: string };

export function queSeBusca(e: EleccionDeQue | null): QueSeBusca | null {
  if (!e) return null;
  if (e.tipo === "promo") return { tipo: "promo", id: e.promo.id };
  if (e.tipo === "comprado") {
    // Depilación va por el ancla: el id no importa, sólo tiene que ser un uuid.
    if (e.linea.esDepilacion) return { tipo: "depilacion", id: e.linea.purchaseServiceId };
    return e.linea.serviceId ? { tipo: "servicio", id: e.linea.serviceId } : null;
  }
  if (e.tipo === "servicio") return { tipo: "servicio", id: e.item.id };
  if (e.tipo === "combo" || e.tipo === "pack") return { tipo: "combo", id: e.item.id };
  if (e.tipo === "depilacion") return { tipo: "depilacion", id: e.item.id };
  return null;
}
