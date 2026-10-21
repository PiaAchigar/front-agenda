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

/**
 * Las clases CSS de cada estado del cupo: `barra` (progreso de la card), `tono`
 * (Badge del cupo), `cupo` (el "5/8" de la pastilla de la semana) y `punto`
 * (lo que se le suma al puntito del mes). El color de fondo de la pastilla y
 * del punto es el del TIPO (`COLOR_DE_TIPO`): el estado se ve encima.
 */
export const COLOR_DE_CLASE: Record<
  EstadoDeClase,
  { barra: string; tono: "neutral" | "warning" | "danger"; cupo: string; punto: string }
> = {
  "con-lugar": { barra: "bg-primary", tono: "neutral", cupo: "", punto: "" },
  llena: { barra: "bg-amber-500", tono: "warning", cupo: "font-semibold text-amber-700", punto: "ring-2 ring-amber-500 ring-offset-1" },
  sobrecupo: { barra: "bg-red-500", tono: "danger", cupo: "font-semibold text-red-700", punto: "ring-2 ring-red-500 ring-offset-1" },
  pasada: { barra: "bg-gray-400", tono: "neutral", cupo: "", punto: "opacity-40" },
};

/** Cómo se ve una clase pasada en la semana: su color, pero apagado. */
export const PASTILLA_PASADA = "opacity-60";

/**
 * Un color por tipo, para distinguir a simple vista una actividad de una
 * capacitación: `pastilla` (semana), `punto` (mes), `insignia` (la etiqueta
 * "Actividad"/"Capacitación" de la card) y `borde` (el borde izquierdo de la
 * card del día). Lo usa también Referencias, así nunca se desencuentran.
 */
export const COLOR_DE_TIPO: Record<
  ClassOccurrence["kind"],
  { nombre: string; pastilla: string; punto: string; insignia: string; borde: string }
> = {
  activity: {
    nombre: "Actividad",
    pastilla: "bg-sky-50 text-sky-900 border-sky-500",
    punto: "bg-sky-500",
    insignia: "bg-sky-100 text-sky-800",
    borde: "border-l-sky-500",
  },
  training: {
    nombre: "Capacitación",
    pastilla: "bg-violet-50 text-violet-900 border-violet-500",
    punto: "bg-violet-500",
    insignia: "bg-violet-100 text-violet-800",
    borde: "border-l-violet-500",
  },
};

/** La pastilla "Debe $X" de una anotada: la misma en el día, la semana, el mes y Referencias. */
export const ESTILO_DEBE = "rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-800";
