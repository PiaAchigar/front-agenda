/** El primer día libre desde hoy (inclusive), o null. Fechas YYYY-MM-DD comparables como texto. */
export function primerDiaLibre(dias: readonly string[], hoy: string): string | null {
  return [...dias].filter((d) => d >= hoy).sort()[0] ?? null;
}
