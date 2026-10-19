/** Query params que sobreviven al pasar de una vista de la agenda a otra. */
export const PARAMS_QUE_SE_CONSERVAN = ["prestadora", "servicio", "con", "date"];

/**
 * `path` con los params de la agenda que ya estaban puestos (la búsqueda, la
 * clienta, el día) más los `extra`, que pisan a los conservados.
 */
export function rutaConservando(
  path: string,
  actuales: URLSearchParams,
  extra: Record<string, string> = {},
): string {
  const qs = new URLSearchParams();
  for (const k of PARAMS_QUE_SE_CONSERVAN) {
    const v = actuales.get(k);
    if (v) qs.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
