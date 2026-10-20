/**
 * Meses a los que se puede anotar desde una clase: el mes de la clase y, si la
 * clase cae del 25 en adelante, también el siguiente (spec §3.2).
 * @param fechaDeLaClase YYYY-MM-DD
 */
export function mesesParaAnotar(fechaDeLaClase: string): string[] {
  const [y, m, d] = fechaDeLaClase.split("-").map(Number);
  const mes = `${y}-${String(m).padStart(2, "0")}`;
  if (d < 25) return [mes];
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return [mes, sig];
}
