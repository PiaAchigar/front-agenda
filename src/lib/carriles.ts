export type Tramo = { id: string; inicio: number; fin: number };

/**
 * Reparte en carriles (columnas lado a lado) los turnos de un día para que los
 * que se pisan no se tapen.
 *
 * `total` es el ancho del GRUPO que se pisa, no el del día: un turno solo a la
 * tarde ocupa todo el ancho aunque a la mañana haya tres en paralelo. Un turno
 * reusa el primer carril que ya terminó (A pisa a B, B a C, A no a C → C va en
 * el carril de A).
 */
export function carriles(turnos: Tramo[]): Map<string, { carril: number; total: number }> {
  const orden = [...turnos].sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  const resultado = new Map<string, { carril: number; total: number }>();

  let grupo: { id: string; carril: number }[] = [];
  let finPorCarril: number[] = [];

  function cerrarGrupo() {
    for (const t of grupo) resultado.set(t.id, { carril: t.carril, total: finPorCarril.length });
    grupo = [];
    finPorCarril = [];
  }

  for (const t of orden) {
    // Si empieza cuando todos los carriles ya terminaron, es un grupo nuevo.
    if (grupo.length > 0 && finPorCarril.every((fin) => fin <= t.inicio)) cerrarGrupo();
    let carril = finPorCarril.findIndex((fin) => fin <= t.inicio);
    if (carril === -1) carril = finPorCarril.length;
    finPorCarril[carril] = t.fin;
    grupo.push({ id: t.id, carril });
  }
  cerrarGrupo();
  return resultado;
}
