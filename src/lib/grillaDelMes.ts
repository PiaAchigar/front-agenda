import { addDays } from "./format";

export function ymd(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Mediodía UTC: a esa hora el día es el mismo en cualquier huso razonable. */
export function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

/** Grilla Lun → Dom con semanas completas del mes de `anchorDate` (YYYY-MM-DD). */
export function diasDeLaGrilla(anchorDate: string): { year: number; month0: number; days: string[] } {
  const base = utcDate(anchorDate);
  const year = base.getUTCFullYear();
  const month0 = base.getUTCMonth();
  const firstOfMonth = ymd(year, month0, 1);
  const firstDow = utcDate(firstOfMonth).getUTCDay(); // 0=Dom … 6=Sáb
  const leading = firstDow === 0 ? 6 : firstDow - 1; // offset hacia el lunes
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const weeks = Math.ceil((leading + daysInMonth) / 7);
  const gridStart = addDays(firstOfMonth, -leading);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  return { year, month0, days };
}

export function etiquetaDelMes(year: number, month0: number): string {
  const raw = utcDate(ymd(year, month0, 1)).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** "2026-10" → "2026-11". El día 1 + 31 siempre cae dentro del mes que sigue. */
export function mesSiguiente(month: string): string {
  return addDays(`${month}-01`, 31).slice(0, 7);
}

/** "2026-10" → "2026-09". */
export function mesAnterior(month: string): string {
  return addDays(`${month}-01`, -1).slice(0, 7);
}
