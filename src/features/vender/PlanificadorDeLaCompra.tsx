import { useEffect, useMemo, useState } from "react";
import { type BaseDelPlanificador, useAgendarLote, useBasePlanificador, useDisponibilidadEnLote } from "../../api/planificador";
import type { CreateAppointmentInput } from "../../api/agenda";
import type { Availability, AvailabilitySlot } from "../../api/types";
import { Button, ErrorNote } from "../../components/ui";
import { addDays } from "../../lib/format";
import {
  type CardDelPlan,
  type Habilitacion,
  type Inicio,
  armarPlan,
  avisos,
  elegirPrestadora,
  habilitacion,
  recalcular,
} from "../../lib/planificador";
import { toArgentinaISO } from "../../lib/reagendar";

const selectClass =
  "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-surface-low disabled:text-ink-soft";

/** Hasta cuántos días se busca el siguiente día hábil de una card cuyo día está cerrado. */
const MAX_DIAS_CORRIDOS = 7;

export type PlanificadorProps = {
  compraId: string;
  customerName: string;
  /** Del hueco donde se abrió el Nuevo turno: día, hora y prestadora de la card 1. */
  inicio: Inicio;
  /** Cierra el Nuevo turno. */
  onListo: () => void;
};

type Estado = { libre: true } | { libre: false; libreDesde: string | null } | null;
type ErrorDeCard = { clave: string; mensaje: string };

const fechaLarga = (f: string, weekday: "long" | "short") =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString("es-AR", { weekday, timeZone: "UTC" });

/** "Jue 22/10". */
function titularDelDia(f: string): string {
  const dia = fechaLarga(f, "short").replace(".", "");
  const [, m, d] = f.split("-");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d}/${m}`;
}

const ddmm = (f: string) => f.split("-").reverse().slice(0, 2).join("/");

function proximoLibre(slots: AvailabilitySlot[], hora: string): string | null {
  return (
    slots
      .filter((s) => s.start > hora && s.options.length > 0)
      .sort((a, b) => a.start.localeCompare(b.start))[0]?.start ?? null
  );
}

/**
 * Las cards con prestadora y estado resueltos contra la disponibilidad. Se
 * calcula en cada render (no se guarda): así, después de armar el plan, de
 * recalcular y de cada edición, las cards no tocadas vuelven a elegir prestadora.
 */
function resolver(
  cards: CardDelPlan[],
  hab: Map<string, Habilitacion>,
  resultados: Availability[] | undefined,
  preferida: string | null,
): { cards: CardDelPlan[]; estados: Estado[] } {
  const out = cards.map((c) => ({ ...c, marcada: c.marcada && (hab.get(c.clave)?.habilitada ?? false) }));
  const estados: Estado[] = out.map(() => null);
  out.forEach((c, i) => {
    const av = resultados?.[i];
    if (!av || av.date !== c.fecha) return;
    if (!c.tocada) {
      const e = elegirPrestadora(c, av.slots, out, preferida);
      if (e.libre) {
        out[i] = { ...c, providerId: e.providerId, providerName: e.providerName, machineId: e.machineId };
        estados[i] = { libre: true };
      } else {
        estados[i] = { libre: false, libreDesde: e.libreDesde };
      }
      return;
    }
    const opcion = av.slots.find((s) => s.start === c.hora)?.options.find((o) => o.providerId === c.providerId);
    if (opcion) {
      out[i] = { ...c, machineId: opcion.machineId };
      estados[i] = { libre: true };
    } else {
      estados[i] = { libre: false, libreDesde: proximoLibre(av.slots, c.hora) };
    }
  });
  return { cards: out, estados };
}

/**
 * Después de vender algo de varias sesiones: una card por sesión con día, hora y
 * prestadora sugeridos (spec 2026-10-22-planificador-de-la-compra). Laura edita,
 * destilda o agenda todo junto; lo que no agenda queda "A agendar" en el CRM.
 */
export function PlanificadorDeLaCompra(p: PlanificadorProps) {
  const baseQ = useBasePlanificador(p.compraId);
  const base = baseQ.data;
  if (!base) {
    return baseQ.error ? (
      <ErrorNote message={`No se pudo armar el plan: ${(baseQ.error as Error).message}`} />
    ) : (
      <p className="text-sm text-ink-soft">Cargando…</p>
    );
  }
  return <Plan {...p} base={base} />;
}

function Plan({ base, customerName, inicio, onListo }: PlanificadorProps & { base: BaseDelPlanificador }) {
  const [diasTexto, setDiasTexto] = useState(String(base.intervalo.dias));
  const [cards, setCards] = useState<CardDelPlan[]>(() => armarPlan(base, inicio, base.intervalo.dias));
  // Cards que la puerta de pago apagó: al habilitarse de nuevo hay que tildarlas a mano.
  const [bloqueadas, setBloqueadas] = useState<ReadonlySet<string>>(new Set());
  const [errorDeCard, setErrorDeCard] = useState<ErrorDeCard | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [agendadas, setAgendadas] = useState<number | null>(null);
  const lote = useAgendarLote();

  const consultas = useMemo(
    () => cards.map((c) => ({ serviceId: c.sesion.serviceId, date: c.fecha, durationMinutes: c.sesion.duracionMinutos })),
    [cards],
  );
  const disponibilidad = useDisponibilidadEnLote(consultas);
  const resultados = disponibilidad.data?.resultados;

  // Día cerrado: la sugerencia pasa al siguiente día (hasta 7) y la card lo dice.
  useEffect(() => {
    if (!resultados) return;
    let cambio = false;
    const nuevas = cards.map((c, i) => {
      const r = resultados[i];
      if (c.tocada || !r || r.date !== c.fecha || r.reason !== "closed") return c;
      const desde = c.corridaDesde ?? c.fecha;
      if (c.fecha >= addDays(desde, MAX_DIAS_CORRIDOS)) return c;
      cambio = true;
      return { ...c, fecha: addDays(c.fecha, 1), corridaDesde: desde };
    });
    if (cambio) setCards(nuevas);
  }, [resultados, cards]);

  const hab = useMemo(() => habilitacion(cards, base, base.sesiones.length), [cards, base]);
  const sinBloqueadas = useMemo(() => cards.map((c) => ({ ...c, marcada: c.marcada && !bloqueadas.has(c.clave) })), [cards, bloqueadas]);
  const vista = useMemo(() => resolver(sinBloqueadas, hab, resultados, inicio.providerId), [sinBloqueadas, hab, resultados, inicio.providerId]);

  useEffect(() => {
    const apagadas = cards.filter((c) => hab.get(c.clave)?.habilitada === false && !bloqueadas.has(c.clave));
    if (apagadas.length > 0) setBloqueadas(new Set([...bloqueadas, ...apagadas.map((c) => c.clave)]));
  }, [cards, hab, bloqueadas]);

  const aAgendar = vista.cards.filter((c) => c.marcada && c.providerId);
  const n = aAgendar.length;

  function editar(clave: string, cambios: Partial<CardDelPlan>) {
    setErrorDeCard(null);
    setCards((prev) => prev.map((c) => (c.clave === clave ? { ...c, ...cambios, tocada: true } : c)));
  }

  function cambiarDias(texto: string) {
    setDiasTexto(texto);
    const nuevo = parseInt(texto, 10);
    if (!(nuevo > 0)) return;
    setCards((prev) => recalcular(prev, inicio, nuevo));
  }

  function agendar() {
    setErrorDeCard(null);
    setErrorGeneral(null);
    const claves = aAgendar.map((c) => c.clave);
    const turnos: CreateAppointmentInput[] = aAgendar.map((c) => ({
      customerId: base.customerId,
      serviceId: c.sesion.serviceId,
      providerId: c.providerId!,
      ...(c.machineId ? { machineId: c.machineId } : {}),
      start: toArgentinaISO(c.fecha, c.hora),
      customerPurchaseServiceId: c.clave,
      ...(c.sesion.esDepilacion ? { zonas: c.sesion.zonas } : {}),
      ...(hab.get(c.clave)?.habilitada && (hab.get(c.clave) as { reserva?: boolean }).reserva
        ? { status: "reserved" as const, expiryMinutes: 1440 }
        : {}),
    }));
    lote.mutate(
      { turnos },
      {
        onSuccess: () => setAgendadas(turnos.length),
        onError: (e) => {
          const indice = (e as Error & { indice?: number }).indice;
          const clave = indice != null ? claves[indice] : undefined;
          if (clave) setErrorDeCard({ clave, mensaje: e.message });
          else setErrorGeneral(e.message);
        },
      },
    );
  }

  if (agendadas !== null) {
    const quedan = base.sesiones.length - agendadas;
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">
          {agendadas === 1 ? "Quedó agendada 1 sesión." : `Quedaron agendadas ${agendadas} sesiones.`}
          {quedan > 0 && ` ${quedan} ${quedan === 1 ? "queda" : "quedan"} "A agendar" en la ficha de ${customerName}.`}
        </p>
        <div className="flex justify-end">
          <Button type="button" onClick={onListo}>Listo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-lg font-semibold text-ink">{customerName} · {base.descripcion}</h4>
      <p className="text-xs text-ink-soft">
        No hace falta agendar todo ahora. Lo que dejes sin agendar queda en la ficha de {customerName}, en el CRM, como "A agendar", y lo agendás desde ahí cuando quieras.
      </p>

      <div className="flex items-center gap-2">
        <label htmlFor="plan-dias" className="text-sm text-ink">Una sesión cada</label>
        <input
          id="plan-dias"
          type="number"
          min={1}
          className="w-20 rounded-xl border border-surface-highest bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
          value={diasTexto}
          onChange={(e) => cambiarDias(e.target.value)}
        />
        <span className="text-sm text-ink">días</span>
      </div>
      {!base.intervalo.cargado && (
        <p className="-mt-2 text-xs text-ink-soft">Sugerido: este pack no tiene días cargados</p>
      )}

      <div className="space-y-2">
        {cards.map((c, i) => {
          const h = hab.get(c.clave);
          const resuelta = vista.cards[i]!;
          const estado = vista.estados[i]!;
          const conError = errorDeCard?.clave === c.clave;
          const apagada = h?.habilitada === false;
          const av = avisos(resuelta, vista.cards, base);
          const slots = resultados?.[i]?.date === c.fecha ? resultados[i]!.slots : [];
          const opciones = slots.find((s) => s.start === c.hora)?.options ?? [];
          const actual = resuelta.providerId;
          return (
            <div
              key={c.clave}
              data-testid="card-sesion"
              className={`space-y-2 rounded-xl border px-3 py-2 ${conError ? "border-red-300 bg-red-50" : "border-surface-highest bg-white"} ${apagada ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">
                  Sesión {i + 1}
                  <span className="ml-2 text-xs font-normal text-ink-soft">{c.sesion.nombre} · {titularDelDia(c.fecha)}</span>
                </p>
                <label className="flex items-center gap-1.5 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={!apagada && c.marcada && !bloqueadas.has(c.clave)}
                    disabled={apagada}
                    onChange={(e) => {
                      setBloqueadas((prev) => new Set([...prev].filter((k) => k !== c.clave)));
                      setCards((prev) => prev.map((x) => (x.clave === c.clave ? { ...x, marcada: e.target.checked } : x)));
                    }}
                  />
                  Agendar
                </label>
              </div>
              {apagada ? (
                <p className="text-xs text-ink-soft">{h.motivo}</p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_6rem] gap-2">
                    <input
                      type="date"
                      aria-label={`Fecha de la sesión ${i + 1}`}
                      className={selectClass}
                      value={c.fecha}
                      onChange={(e) => e.target.value && editar(c.clave, { fecha: e.target.value, corridaDesde: undefined })}
                    />
                    <input
                      type="time"
                      aria-label={`Hora de la sesión ${i + 1}`}
                      className={selectClass}
                      value={c.hora}
                      onChange={(e) => e.target.value && editar(c.clave, { hora: e.target.value })}
                    />
                  </div>
                  <select
                    aria-label={`Prestadora de la sesión ${i + 1}`}
                    className={selectClass}
                    value={actual ?? ""}
                    onChange={(e) => {
                      const o = opciones.find((x) => x.providerId === e.target.value);
                      if (o) editar(c.clave, { providerId: o.providerId, providerName: o.providerName, machineId: o.machineId });
                    }}
                  >
                    {!actual && <option value="">Sin prestadora</option>}
                    {actual && !opciones.some((o) => o.providerId === actual) && (
                      <option value={actual}>{resuelta.providerName ?? "Prestadora"}</option>
                    )}
                    {opciones.map((o) => (
                      <option key={o.providerId} value={o.providerId}>{o.providerName}</option>
                    ))}
                  </select>
                  <div className="space-y-0.5 text-xs">
                    <p className={estado?.libre === false ? "text-amber-800" : "text-ink-soft"}>
                      {estado === null
                        ? "Consultando horarios…"
                        : estado.libre
                          ? "Libre"
                          : estado.libreDesde
                            ? `Ocupada · libre desde ${estado.libreDesde}`
                            : "Ocupada · sin lugar ese día"}
                    </p>
                    {c.corridaDesde && <p className="text-ink-soft">se corrió al {fechaLarga(c.fecha, "long")}</p>}
                    {h?.habilitada && h.reserva && <p className="text-ink-soft">Va como reserva de 24 h</p>}
                    {av.fueraDeVigencia && base.venceEl && (
                      <p className="text-amber-800">Queda fuera de la vigencia (vence el {ddmm(base.venceEl)})</p>
                    )}
                    {av.superpuesta && <p className="text-amber-800">Se superpone con otro turno de {customerName}</p>}
                  </div>
                </>
              )}
              {conError && <p className="text-xs font-medium text-red-800">{errorDeCard!.mensaje}</p>}
            </div>
          );
        })}
      </div>

      {errorGeneral && <ErrorNote message={errorGeneral} />}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onListo}>Dejar todo para después</Button>
        <Button type="button" disabled={n === 0 || lote.isPending} onClick={agendar}>
          {`Agendar ${n} ${n === 1 ? "sesión" : "sesiones"}`}
        </Button>
      </div>
    </div>
  );
}
