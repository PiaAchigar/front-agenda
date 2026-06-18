const TZ = "America/Argentina/Buenos_Aires";

/** Fecha local ART como YYYY-MM-DD (para usar como valor de <input type="date">). */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** "HH:MM" en hora local ART a partir de un ISO UTC. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** "DD/MM/AAAA" a partir de "YYYY-MM-DD". */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** "DD/MM/AAAA HH:MM" en hora local ART a partir de un ISO UTC. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Suma N días a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Minutos desde medianoche local ART de un ISO UTC. */
export function isoToLocalMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  const [h = 0, m = 0] = parts.split(":").map(Number);
  return h * 60 + m;
}
