import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProvidersByServices } from "../api/agenda";

/**
 * Los filtros de la agenda: de 0 a N prestadoras y de 0 a N servicios, a la
 * vez. Viven en la URL (`?prestadora=a&prestadora=b&servicio=c`, parámetros
 * repetidos) para que sobrevivan al cambio entre día, semana y mes, y a
 * recargar. Arreglo vacío = sin filtro de ese tipo.
 */
export type Busqueda = { prestadoras: string[]; servicios: string[] };
export type TipoDeFiltro = "prestadora" | "servicio";

type Opcion = { id: string; name: string };

export function leerBusqueda(params: URLSearchParams): Busqueda {
  return { prestadoras: params.getAll("prestadora"), servicios: params.getAll("servicio") };
}

/**
 * Devuelve una copia de `params` con los filtros puestos. Pisa lo anterior y
 * borra `con`: ese parámetro viejo ya no existe (ahora "La hacen:" suma la
 * prestadora como un filtro más).
 */
export function escribirBusqueda(params: URLSearchParams, b: Busqueda): URLSearchParams {
  const siguiente = new URLSearchParams(params);
  siguiente.delete("prestadora");
  siguiente.delete("servicio");
  siguiente.delete("con");
  for (const id of b.prestadoras) siguiente.append("prestadora", id);
  for (const id of b.servicios) siguiente.append("servicio", id);
  return siguiente;
}

const clave = (tipo: TipoDeFiltro) => (tipo === "prestadora" ? "prestadoras" : "servicios");

/** Suma un filtro al final; si ya estaba, queda todo igual. */
export function agregarAlFiltro(b: Busqueda, tipo: TipoDeFiltro, id: string): Busqueda {
  const k = clave(tipo);
  if (b[k].includes(id)) return b;
  return { ...b, [k]: [...b[k], id] };
}

/** Saca sólo ese filtro. */
export function quitarDelFiltro(b: Busqueda, tipo: TipoDeFiltro, id: string): Busqueda {
  const k = clave(tipo);
  return { ...b, [k]: b[k].filter((x) => x !== id) };
}

/**
 * Qué prestadoras deja ver la búsqueda: las elegidas si hay; si no, las que
 * hacen algún servicio elegido (`delosServicios`); si no hay filtro,
 * `undefined` (todas).
 */
export function prestadorasVisibles(b: Busqueda, delosServicios: string[]): string[] | undefined {
  if (b.prestadoras.length > 0) return b.prestadoras;
  if (b.servicios.length > 0) return delosServicios;
  return undefined;
}

const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Hasta `max` coincidencias por grupo; con menos de 2 letras no sugiere nada. */
export function sugerencias(
  texto: string,
  prestadoras: Opcion[],
  servicios: Opcion[],
  max = 6,
): { prestadoras: Opcion[]; servicios: Opcion[] } {
  if (texto.trim().length < 2) return { prestadoras: [], servicios: [] };
  const q = sinTildes(texto.trim());
  const filtrar = (lista: Opcion[]) =>
    lista.filter((o) => sinTildes(o.name).includes(q)).slice(0, max);
  return { prestadoras: filtrar(prestadoras), servicios: filtrar(servicios) };
}

export function useBusquedaAgenda() {
  const [params, setParams] = useSearchParams();
  // `params` cambia de identidad sólo cuando cambia la URL.
  const busqueda = useMemo(() => leerBusqueda(params), [params]);
  const modificar = useCallback(
    (cambio: (b: Busqueda) => Busqueda) =>
      setParams((actuales) => escribirBusqueda(actuales, cambio(leerBusqueda(actuales))), { replace: true }),
    [setParams],
  );
  const agregar = useCallback(
    (tipo: TipoDeFiltro, id: string) => modificar((b) => agregarAlFiltro(b, tipo, id)),
    [modificar],
  );
  const quitar = useCallback(
    (tipo: TipoDeFiltro, id: string) => modificar((b) => quitarDelFiltro(b, tipo, id)),
    [modificar],
  );
  return { busqueda, agregar, quitar };
}

/**
 * Qué prestadoras deja ver la búsqueda actual (ver `prestadorasVisibles`).
 * Mientras llegan las de los servicios es `[]`: mejor nada que mostrar todas y
 * que después desaparezcan.
 */
export function usePrestadorasDeLaBusqueda(): string[] | undefined {
  const { busqueda } = useBusquedaAgenda();
  const { porServicio } = useProvidersByServices(busqueda.servicios);
  const delosServicios = [...new Set(busqueda.servicios.flatMap((id) => (porServicio.get(id) ?? []).map((p) => p.id)))];
  return prestadorasVisibles(busqueda, delosServicios);
}
