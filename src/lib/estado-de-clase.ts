import type { ClassOccurrence } from "../api/types";

export type EstadoDeClase = "pasada" | "sobrecupo" | "llena" | "con-lugar";

/** En qué estado está una clase: lo comparten la card del día, la pastilla de la semana y Referencias. */
export function estadoDeClase(o: ClassOccurrence, ahora: Date): EstadoDeClase {
  if (new Date(o.startsAt).getTime() <= ahora.getTime()) return "pasada";
  if (o.capacity === null) return "con-lugar";
  if (o.enrolledCount > o.capacity) return "sobrecupo";
  if (o.enrolledCount >= o.capacity) return "llena";
  return "con-lugar";
}

/** Las clases CSS de cada estado: `barra` (progreso), `tono` (Badge) y `pastilla` (semana). */
export const COLOR_DE_CLASE: Record<
  EstadoDeClase,
  { barra: string; tono: "neutral" | "warning" | "danger"; pastilla: string }
> = {
  "con-lugar": { barra: "bg-primary", tono: "neutral", pastilla: "bg-primary/10 text-primary border-primary" },
  llena: { barra: "bg-amber-500", tono: "warning", pastilla: "bg-amber-50 text-amber-800 border-amber-500" },
  sobrecupo: { barra: "bg-red-500", tono: "danger", pastilla: "bg-red-50 text-red-800 border-red-500" },
  pasada: { barra: "bg-gray-400", tono: "neutral", pastilla: "bg-gray-100 text-gray-500 border-gray-400" },
};

/** La pastilla "Debe $X" de una anotada: la misma en el día, la semana, el mes y Referencias. */
export const ESTILO_DEBE = "rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-800";
