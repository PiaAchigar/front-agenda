import type { Consumo, InsumoFaltante } from "../api/types";

/**
 * ¿Hay que interrumpir a quien completó el turno?
 *
 * Sólo si algún insumo quedó en negativo. Un descuento que salió bien no abre
 * nada: un modal en cada turno completado se aprende a cerrar sin leer, y
 * entonces el aviso deja de servir justo cuando importa.
 *
 * Los insumos archivados que no se descontaron tampoco abren el modal — son un
 * problema de la receta, no algo a resolver mientras se atiende.
 */
export function hayQueAvisar(consumo: Consumo | undefined): boolean {
  return (consumo?.faltantes.length ?? 0) > 0;
}

/** Qué pasó con un insumo que quedó en negativo, en una frase. */
export function descripcionDeFaltante(f: InsumoFaltante): string {
  if (f.stockAntes == null) {
    // "tenía 0" sería mentira: nadie lo contó. Y el arreglo es otro — cargar el
    // stock, no salir a comprar.
    return `quedó en ${f.stockDespues} y no tenía stock cargado`;
  }
  return `quedó en ${f.stockDespues}, tenía ${f.stockAntes} y se usaron ${f.quantity}`;
}
