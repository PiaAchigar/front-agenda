import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ClassOccurrence } from "../api/types";

/**
 * La búsqueda de "Turnos grupales": de 0 a N actividades y de 0 a N
 * capacitaciones. Vive en la URL (`?actividad=a&capacitacion=c`, parámetros
 * repetidos) igual que la individual, y no toca `prestadora`/`servicio`.
 */
export type BusquedaGrupal = { actividades: string[]; capacitaciones: string[] };
export type TipoGrupal = "actividad" | "capacitacion";

export function leerBusquedaGrupal(params: URLSearchParams): BusquedaGrupal {
  return { actividades: params.getAll("actividad"), capacitaciones: params.getAll("capacitacion") };
}

export function escribirBusquedaGrupal(params: URLSearchParams, b: BusquedaGrupal): URLSearchParams {
  const siguiente = new URLSearchParams(params);
  siguiente.delete("actividad");
  siguiente.delete("capacitacion");
  for (const id of b.actividades) siguiente.append("actividad", id);
  for (const id of b.capacitaciones) siguiente.append("capacitacion", id);
  return siguiente;
}

const clave = (tipo: TipoGrupal) => (tipo === "actividad" ? "actividades" : "capacitaciones");

/** Suma un filtro al final; si ya estaba, queda todo igual. */
export function agregarAlFiltroGrupal(b: BusquedaGrupal, tipo: TipoGrupal, id: string): BusquedaGrupal {
  const k = clave(tipo);
  if (b[k].includes(id)) return b;
  return { ...b, [k]: [...b[k], id] };
}

/** Saca sólo ese filtro. */
export function quitarDelFiltroGrupal(b: BusquedaGrupal, tipo: TipoGrupal, id: string): BusquedaGrupal {
  const k = clave(tipo);
  return { ...b, [k]: b[k].filter((x) => x !== id) };
}

export const hayFiltrosGrupales = (b: BusquedaGrupal) => b.actividades.length + b.capacitaciones.length > 0;

/**
 * Sin filtros se ve todo; con filtros, las clases de lo elegido (o entre los
 * dos tipos). Manda `kind`: un id de actividad no filtra una capacitación.
 */
export function claseVisible(o: ClassOccurrence, b: BusquedaGrupal): boolean {
  if (!hayFiltrosGrupales(b)) return true;
  return o.kind === "activity" ? b.actividades.includes(o.subjectId) : b.capacitaciones.includes(o.subjectId);
}

export function useBusquedaGrupal() {
  const [params, setParams] = useSearchParams();
  const busqueda = useMemo(() => leerBusquedaGrupal(params), [params]);
  const modificar = useCallback(
    (cambio: (b: BusquedaGrupal) => BusquedaGrupal) =>
      setParams((actuales) => escribirBusquedaGrupal(actuales, cambio(leerBusquedaGrupal(actuales))), {
        replace: true,
      }),
    [setParams],
  );
  const agregar = useCallback(
    (tipo: TipoGrupal, id: string) => modificar((b) => agregarAlFiltroGrupal(b, tipo, id)),
    [modificar],
  );
  const quitar = useCallback(
    (tipo: TipoGrupal, id: string) => modificar((b) => quitarDelFiltroGrupal(b, tipo, id)),
    [modificar],
  );
  return { busqueda, agregar, quitar };
}
