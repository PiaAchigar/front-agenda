/**
 * Conversión de fechas para el modal de reagendado.
 *
 * Vive acá y no dentro del componente para poder testearla: es la parte que
 * puede mover un turno de día sin que nadie lo note, porque el navegador de
 * quien lo usa no está necesariamente en horario argentino.
 */

const TZ = "America/Argentina/Buenos_Aires";

/**
 * Arma el ISO que espera el backend a partir de lo que se eligió en pantalla.
 *
 * El offset va fijo en -03:00 porque el negocio está en Argentina y el país no
 * cambia de huso. Tomar el offset del navegador haría que reagendar desde una
 * compu con otra zona horaria guardara el turno corrido.
 */
export function toArgentinaISO(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00-03:00`;
}

/** Parte un ISO UTC en la fecha y la hora ARGENTINAS, para prellenar los inputs. */
export function isoToDateAndTime(iso: string): { date: string; time: string } {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (t: string) => local.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
