import { addDays } from "../../lib/format";

// ── Constantes del grid ──────────────────────────────────────────────────────
export const PX_PER_MIN       = 2;
export const START_MIN        = 8  * 60;   // 480
export const END_MIN          = 22 * 60;   // 1320
export const SLOT_MIN         = 30;
// La API ofrece huecos cada 15 min (availability.service): la caja mide eso, no un renglón.
export const PASO_HUECO_MIN   = 15;
export const SLOT_PX          = SLOT_MIN * PX_PER_MIN;          // 60 px
export const TOTAL_PX         = (END_MIN - START_MIN) * PX_PER_MIN; // 1680 px
export const TIME_COL_W       = 64;
export const DAY_COL_MIN      = 140;       // px mínimos por columna de día

export const SLOTS = Array.from(
  { length: (END_MIN - START_MIN) / SLOT_MIN },
  (_, i) => START_MIN + i * SLOT_MIN,
);

export const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function minToLabel(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function timeStrToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Lunes de la semana que contiene `dateStr`. */
export function weekStart(dateStr: string): string {
  const d   = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

