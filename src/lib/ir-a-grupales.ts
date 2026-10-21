import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { TipoGrupal } from "./busqueda-grupal";
import { useModoAgenda } from "./modo-agenda";

/** El Día de esa fecha, filtrado por esa actividad o capacitación. */
export function rutaDeGrupales(tipo: TipoGrupal, id: string, fecha: string): string {
  return `/dia?${new URLSearchParams({ date: fecha, [tipo]: id }).toString()}`;
}

/**
 * Desde el Nuevo turno de una prestadora: anotar en una actividad o
 * capacitación que dicta se hace en Turnos grupales, así que se pasa a ese
 * modo y al Día de esa fecha con el filtro puesto.
 */
export function useIrAGrupales() {
  const [, setModo] = useModoAgenda();
  const navigate = useNavigate();
  return useCallback(
    (tipo: TipoGrupal, id: string, fecha: string) => {
      setModo("clases");
      navigate(rutaDeGrupales(tipo, id, fecha));
    },
    [setModo, navigate],
  );
}
