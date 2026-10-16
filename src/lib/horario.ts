const TZ = "America/Argentina/Buenos_Aires";

export const AVISO_HORARIO_PASADO = "Ese horario ya pasó. Elegí uno a partir de ahora.";

/** Fecha (YYYY-MM-DD) y minutos desde medianoche de un instante, en hora argentina. */
export function ahoraEnArgentina(ahora: Date = new Date()): { fecha: string; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(ahora);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "0";
  return { fecha: `${p("year")}-${p("month")}-${p("day")}`, minutos: Number(p("hour")) * 60 + Number(p("minute")) };
}

/**
 * Si un horario (día + minutos desde medianoche, en hora argentina) ya empezó.
 * Regla 1.9: se decide en ART, nunca con la hora del navegador. La API rechaza
 * igual un turno en el pasado; esto es para que Laura se entere antes.
 */
export function yaPaso(fecha: string, minutos: number, ahora: Date = new Date()): boolean {
  const a = ahoraEnArgentina(ahora);
  if (fecha !== a.fecha) return fecha < a.fecha;
  return minutos < a.minutos;
}
