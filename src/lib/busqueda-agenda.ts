import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProvidersByService } from "../api/agenda";

/**
 * La búsqueda de la agenda: una prestadora o un servicio, nunca los dos.
 * Vive en la URL (`?prestadora=` / `?servicio=`) para que sobreviva al cambio
 * entre día, semana y mes, y a recargar.
 */
export type Busqueda =
  | { tipo: "prestadora"; id: string }
  | { tipo: "servicio"; id: string }
  | null;

type Opcion = { id: string; name: string };

/** Si están los dos parámetros, gana `servicio`. */
export function leerBusqueda(params: URLSearchParams): Busqueda {
  const servicio = params.get("servicio");
  if (servicio) return { tipo: "servicio", id: servicio };
  const prestadora = params.get("prestadora");
  if (prestadora) return { tipo: "prestadora", id: prestadora };
  return null;
}

/**
 * Devuelve una copia de `params` con la búsqueda puesta (o sacada, si es
 * null). Cambiar o limpiar la búsqueda también borra `con`: ese parámetro
 * (la prestadora elegida en "La hacen:") sólo tiene sentido dentro de la
 * búsqueda de servicio que la ofreció.
 */
export function escribirBusqueda(params: URLSearchParams, b: Busqueda): URLSearchParams {
  const siguiente = new URLSearchParams(params);
  siguiente.delete("prestadora");
  siguiente.delete("servicio");
  siguiente.delete("con");
  if (b) siguiente.set(b.tipo, b.id);
  return siguiente;
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

export function useBusquedaAgenda(): [Busqueda, (b: Busqueda) => void] {
  const [params, setParams] = useSearchParams();
  const busqueda = useMemo(() => leerBusqueda(params), [params]);
  const cambiar = useCallback(
    (b: Busqueda) => setParams((actuales) => escribirBusqueda(actuales, b), { replace: true }),
    [setParams],
  );
  return [busqueda, cambiar];
}

/**
 * Qué prestadoras deja ver la búsqueda actual: una sola, las de un servicio,
 * (o esa sola si vino `con`), o `undefined` si no hay búsqueda (todas). Mientras llegan las de un servicio
 * es `[]`: mejor nada que mostrar todas y que después desaparezcan.
 */
export function usePrestadorasDeLaBusqueda(): string[] | undefined {
  const [busqueda] = useBusquedaAgenda();
  const [params] = useSearchParams();
  const con = params.get("con");
  const { data: delServicio } = useProvidersByService(
    busqueda?.tipo === "servicio" ? busqueda.id : null,
  );
  return useMemo(() => {
    if (!busqueda) return undefined;
    if (busqueda.tipo === "prestadora") return [busqueda.id];
    // `con` (la prestadora tocada en "La hacen:") deja a una sola.
    return (delServicio ?? []).map((p) => p.id).filter((id) => !con || id === con);
  }, [busqueda, delServicio, con]);
}
