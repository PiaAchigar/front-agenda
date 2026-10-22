import type { BaseDelPlanificador, SesionPlanificable } from "../api/planificador";
import type { AvailabilitySlot } from "../api/types";
import { addDays, isoToLocalDate, isoToLocalMinutes } from "./format";
import { minutosDe, pesos } from "./vender";

// Las cards del planificador de la compra (spec 2026-10-22-planificador-de-la-compra):
// funciones puras, sin red ni estado.

export type Inicio = { fecha: string; hora: string; providerId: string | null; providerName?: string };

export type CardDelPlan = {
  clave: string; // purchaseServiceId
  sesion: SesionPlanificable;
  paso: number; // 0 para la card 1; cuántos intervalos después
  fecha: string;
  hora: string;
  providerId: string | null;
  providerName?: string;
  machineId?: string | null;
  marcada: boolean;
  tocada: boolean;
  corridaDesde?: string; // fecha sugerida original si se corrió por día cerrado
};

/** 930 → "15:30". */
function horaDe(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Minutos absolutos de una fecha YYYY-MM-DD y una hora local, para comparar días distintos. */
function absolutos(fecha: string, minutosDelDia: number): number {
  return Date.parse(`${fecha}T00:00:00Z`) / 60000 + minutosDelDia;
}

function intervaloDeCard(c: CardDelPlan): [number, number] {
  const ini = absolutos(c.fecha, minutosDe(c.hora));
  return [ini, ini + c.sesion.duracionMinutos];
}

/** ¿La card va encadenada a la anterior (mismo grupo "juntos", misma vuelta)? */
function encadenada(prev: SesionPlanificable | undefined, s: SesionPlanificable): boolean {
  return !!prev && prev.juntos && s.juntos && prev.vuelta === s.vuelta;
}

/** Hora de cada card: la de `inicio`, o encadenada al terminar la anterior del grupo. */
function horaDeLaCard(prev: CardDelPlan | undefined, s: SesionPlanificable, inicioHora: string): string {
  return prev && encadenada(prev.sesion, s)
    ? horaDe(minutosDe(prev.hora) + prev.sesion.duracionMinutos)
    : inicioHora;
}

export function armarPlan(base: BaseDelPlanificador, inicio: Inicio, dias: number): CardDelPlan[] {
  const cards: CardDelPlan[] = [];
  let paso = -1;
  for (const s of base.sesiones) {
    const prev = cards[cards.length - 1];
    if (!encadenada(prev?.sesion, s)) paso += 1;
    cards.push({
      clave: s.purchaseServiceId,
      sesion: s,
      paso,
      fecha: addDays(inicio.fecha, paso * dias),
      hora: horaDeLaCard(prev, s, inicio.hora),
      providerId: inicio.providerId,
      providerName: inicio.providerName,
      machineId: null,
      marcada: true,
      tocada: false,
    });
  }
  return cards;
}

/** Cambió la frecuencia o el inicio: se mueven sólo las cards que Laura no tocó a mano. */
export function recalcular(cards: CardDelPlan[], inicio: Inicio, dias: number): CardDelPlan[] {
  const out: CardDelPlan[] = [];
  for (const c of cards) {
    if (c.tocada) {
      out.push(c);
      continue;
    }
    out.push({
      ...c,
      fecha: addDays(inicio.fecha, c.paso * dias),
      hora: horaDeLaCard(out[out.length - 1], c.sesion, inicio.hora),
      providerId: inicio.providerId,
      providerName: inicio.providerName,
      machineId: null,
      corridaDesde: undefined,
    });
  }
  return out;
}

export type EleccionDePrestadora =
  | { providerId: string; providerName: string; machineId: string | null; libre: true }
  | { libre: false; libreDesde: string | null };

/**
 * Quién hace la card a su hora: la preferida si está libre; si no, la primera libre
 * que no use otra card del plan (prestadora ni máquina) mientras se superponen.
 */
export function elegirPrestadora(
  card: CardDelPlan,
  slots: AvailabilitySlot[],
  otras: CardDelPlan[],
  preferida: string | null,
): EleccionDePrestadora {
  const [ini, fin] = intervaloDeCard(card);
  const vecinas = otras.filter((o) => {
    if (o.clave === card.clave) return false;
    const [oi, of] = intervaloDeCard(o);
    return oi < fin && ini < of;
  });
  const slot = slots.find((s) => s.start === card.hora);
  const libres = (slot?.options ?? []).filter(
    (o) =>
      !vecinas.some(
        (v) => v.providerId === o.providerId || (o.machineId != null && v.machineId === o.machineId),
      ),
  );
  const elegida = libres.find((o) => o.providerId === preferida) ?? libres[0];
  if (elegida) {
    return { providerId: elegida.providerId, providerName: elegida.providerName, machineId: elegida.machineId, libre: true };
  }
  const proximo = slots
    .filter((s) => s.start > card.hora && s.options.length > 0)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return { libre: false, libreDesde: proximo?.start ?? null };
}

export function avisos(
  card: CardDelPlan,
  cards: CardDelPlan[],
  base: BaseDelPlanificador,
): { fueraDeVigencia: boolean; superpuesta: boolean } {
  const [ini, fin] = intervaloDeCard(card);
  const chocaConCard = cards.some((o) => {
    if (o.clave === card.clave || !o.marcada) return false;
    const [oi, of] = intervaloDeCard(o);
    return oi < fin && ini < of;
  });
  const chocaConTurno = base.turnosDeLaClienta.some((t) => {
    const ti = absolutos(isoToLocalDate(t.start), isoToLocalMinutes(t.start));
    const tf = absolutos(isoToLocalDate(t.end), isoToLocalMinutes(t.end));
    return ti < fin && ini < tf;
  });
  return {
    fueraDeVigencia: base.venceEl != null && card.fecha > base.venceEl,
    superpuesta: chocaConCard || chocaConTurno,
  };
}

export type Habilitacion = { habilitada: true; reserva?: boolean } | { habilitada: false; motivo: string };

/** La puerta de pago de depilación aplicada al lote (spec §"Pago y estado de cada turno"). */
export function habilitacion(
  cards: CardDelPlan[],
  base: BaseDelPlanificador,
  todasLasLibres: number,
): Map<string, Habilitacion> {
  const out = new Map<string, Habilitacion>();
  const puerta = base.puerta;
  if (!puerta) {
    for (const c of cards) out.set(c.clave, { habilitada: true });
    return out;
  }
  if (puerta.pagado < puerta.minimo) {
    cards.forEach((c, i) => {
      out.set(
        c.clave,
        i === 0
          ? { habilitada: true, reserva: true }
          : { habilitada: false, motivo: "Se agendan cuando esté pago el 40%" },
      );
    });
    return out;
  }
  const marcadas = cards.filter((c) => c.marcada);
  const ultima =
    marcadas.length === todasLasLibres && puerta.pagado < puerta.total ? marcadas[marcadas.length - 1] : undefined;
  for (const c of cards) {
    out.set(
      c.clave,
      c === ultima
        ? { habilitada: false, motivo: `Se agenda cuando esté pago el total (faltan ${pesos(puerta.total - puerta.pagado)})` }
        : { habilitada: true },
    );
  }
  return out;
}
