import type { CSSProperties } from "react";

/**
 * Qué fondo lleva cada hueco de la grilla (día y semana) y de dónde lo saca la
 * ayuda de "Referencias". Un solo lugar: si cambia un color acá, la ayuda no
 * queda mintiendo.
 *
 * Los cuatro se distinguen por más que el color —textura distinta en cada
 * uno— para que se lean aunque los tonos se parezcan en un monitor lavado.
 */
export type TipoDeHueco = "libre" | "pasado" | "no-atiende" | "cerrado";

/**
 * El orden importa:
 * - "cerrado" (fuera del horario del local) gana sobre todo.
 * - "no atiende" gana sobre "pasado": así, aunque el día ya haya avanzado,
 *   Laura sigue viendo de qué hora a qué hora trabaja cada prestadora.
 */
export function tipoDeHueco({ cerrado, noAtiende, pasado }: {
  cerrado: boolean;
  noAtiende: boolean;
  pasado: boolean;
}): TipoDeHueco {
  if (cerrado) return "cerrado";
  if (noAtiende) return "no-atiende";
  if (pasado) return "pasado";
  return "libre";
}

/** Rayado diagonal gris: la prestadora no trabaja a esa hora. */
const RAYADO =
  "repeating-linear-gradient(-45deg,#f3f4f6,#f3f4f6 4px,#e5e7eb 4px,#e5e7eb 9px)";

/** Punteado tenue en el beige de la marca, sobre blanco: ese horario ya pasó.
 *  Puntos contra rayas y cálido contra gris, para no confundirlo con "no atiende". */
const PUNTEADO = "radial-gradient(circle, #d6c8b8 1.1px, transparent 1.6px)";

export const FONDO_DEL_HUECO: Record<TipoDeHueco, { className: string; style?: CSSProperties }> = {
  libre: { className: "bg-white" },
  pasado: { className: "bg-white", style: { backgroundImage: PUNTEADO, backgroundSize: "8px 8px" } },
  "no-atiende": { className: "", style: { background: RAYADO } },
  cerrado: { className: "bg-surface-high" },
};
