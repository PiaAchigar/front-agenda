import { useCallback, useSyncExternalStore } from "react";

/**
 * Dos formas de mirar la agenda:
 * - "turnos": servicios 1 a 1 — una card por persona (grilla horaria)
 * - "clases": actividades y capacitaciones — una card por clase, con su cupo
 *
 * Son dos agendas distintas: mezclarlas apilaba N cards en el mismo horario y
 * escondía las clases sin nadie anotado.
 */
export type ModoAgenda = "turnos" | "clases";

const CLAVE = "agenda-mode";
const oyentes = new Set<() => void>();

function leer(): ModoAgenda {
  try {
    return localStorage.getItem(CLAVE) === "clases" ? "clases" : "turnos";
  } catch {
    return "turnos";
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/**
 * El modo vive en localStorage y se comparte entre todos los que lo usan
 * (la barra, los tabs y la vista del día), así que cambiarlo en uno actualiza
 * a los demás en el acto.
 */
export function useModoAgenda(): [ModoAgenda, (m: ModoAgenda) => void] {
  const modo = useSyncExternalStore(suscribir, leer, () => "turnos" as ModoAgenda);
  const cambiar = useCallback((m: ModoAgenda) => {
    try {
      localStorage.setItem(CLAVE, m);
    } catch {
      /* sin storage: el modo no se recuerda, pero igual se avisa */
    }
    oyentes.forEach((avisar) => avisar());
  }, []);
  return [modo, cambiar];
}
