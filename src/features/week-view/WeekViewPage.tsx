import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { rutaConservando } from "../../lib/ruta-agenda";
import { useAppointmentsRange, useCompanyConfig, useHuecosDeLaSemana, useProviders, useProvidersByServices, useServices } from "../../api/agenda";
import type { Appointment } from "../../api/types";
import { FONDO_DEL_HUECO, tipoDeHueco } from "../../lib/fondo-del-hueco";
import { yaPaso } from "../../lib/horario";
import { buildProviderColorMap } from "../../lib/colors";
import { addDays, formatDate, isoToLocalDate, isoToLocalMinutes, todayLocal } from "../../lib/format";
import { carriles } from "../../lib/carriles";

function isVisible(appt: { status: string | null; reservationExpiresAt: string | null }): boolean {
  if (appt.status === "cancelled") return false;
  if (appt.status === "reserved" && appt.reservationExpiresAt) {
    return new Date(appt.reservationExpiresAt) > new Date();
  }
  return true;
}

import { saveView } from "../../components/ViewTabs";
import { BarraAgenda } from "../barra/BarraAgenda";
import { BuscadorAgenda } from "../barra/BuscadorAgenda";
import { useBusquedaAgenda, usePrestadorasDeLaBusqueda } from "../../lib/busqueda-agenda";
import { FiltrosAgenda } from "../barra/FiltrosAgenda";
import { HuecoLibre } from "./HuecoLibre";
import { PastillaDeTurno } from "./PastillaDeTurno";
import type { NewApptPrefill } from "../day-view/NewAppointmentModal";
import { NuevoTurnoModal } from "../nuevo-turno/NuevoTurnoModal";

// ── Constantes del grid ──────────────────────────────────────────────────────
const PX_PER_MIN       = 2;
const START_MIN        = 8  * 60;   // 480
const END_MIN          = 22 * 60;   // 1320
const SLOT_MIN         = 30;
// La API ofrece huecos cada 15 min (availability.service): la caja mide eso, no un renglón.
const PASO_HUECO_MIN   = 15;
const SLOT_PX          = SLOT_MIN * PX_PER_MIN;          // 60 px
const TOTAL_PX         = (END_MIN - START_MIN) * PX_PER_MIN; // 1680 px
const TIME_COL_W       = 64;
const DAY_COL_MIN      = 140;       // px mínimos por columna de día

const SLOTS = Array.from(
  { length: (END_MIN - START_MIN) / SLOT_MIN },
  (_, i) => START_MIN + i * SLOT_MIN,
);

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function minToLabel(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function timeStrToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Lunes de la semana que contiene `dateStr`. */
function weekStart(dateStr: string): string {
  const d   = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

// ── Componente ───────────────────────────────────────────────────────────────
export function WeekViewPage() {
  const navigate    = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // La semana vive en la URL (?date=): volver de un día cae en la misma semana.
  const anchorDate = searchParams.get("date") ?? todayLocal();
  const [newApptOpen,    setNewApptOpen]    = useState(false);
  const [newApptDate,    setNewApptDate]    = useState("");
  const [newApptPrefill, setNewApptPrefill] = useState<NewApptPrefill | null>(null);

  function openNewAppt(date: string, minutes: number, extra: Omit<NewApptPrefill, "minutes"> = {}) {
    setNewApptDate(date);
    setNewApptPrefill({ minutes, ...extra });
    setNewApptOpen(true);
  }

  // Bug fix: memoizar monday y weekDates para que no se recreen en cada render,
  // evitando que apptsByDate recalcule innecesariamente.
  const monday    = useMemo(() => weekStart(anchorDate), [anchorDate]);
  const weekDates = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(monday, i)), // Lun a Sáb
    [monday],
  );
  const today = todayLocal();

  const { data: providers = [] } = useProviders();
  const { data: config }         = useCompanyConfig();
  const openHours                = config?.openHours ?? [];

  const colorMap = useMemo(
    () => buildProviderColorMap(providers.map((p) => p.id)),
    [providers],
  );

  // Toda la semana en un solo pedido.
  const { data: turnosDeLaSemana, isLoading } = useAppointmentsRange(weekDates[0]!, weekDates[5]!);

  const prestadorasVisibles = usePrestadorasDeLaBusqueda();

  // Con servicios buscados la semana muestra dónde hay lugar: cada servicio
  // elegido en cada prestadora visible (la API sólo ofrece a las que lo hacen).
  const { busqueda } = useBusquedaAgenda();
  const serviciosIds = busqueda.servicios;
  const buscaLugar = serviciosIds.length > 0;
  const { data: servicios = [] } = useServices();
  const { huecos, cargando: cargandoHuecos, fallo: falloHuecos } = useHuecosDeLaSemana(
    serviciosIds,
    weekDates,
    prestadorasVisibles ?? null,
  );
  const nombreDelServicio = (id: string) => servicios.find((s) => s.id === id)?.name ?? "este servicio";
  // Los carriles de los huecos son fijos en toda la semana: una prestadora cae siempre en el mismo.
  // Un carril por (prestadora, servicio): dos servicios de la misma prestadora
  // a la misma hora no se pisan.
  const { porServicio } = useProvidersByServices(serviciosIds);
  const idsConHuecos = prestadorasVisibles ?? [];
  const carrilesDeHuecos = serviciosIds.flatMap((sid) =>
    idsConHuecos.filter((pid) => (porServicio.get(sid) ?? []).some((p) => p.id === pid)).map((pid) => `${pid}|${sid}`),
  );
  const sinLugar = buscaLugar && !cargandoHuecos && !falloHuecos && idsConHuecos.length > 0 && huecos.length === 0;

  // Sólo turnos de servicio: las inscripciones a clases y capacitaciones viven
  // en la vista "Clases" (6 inscriptas al mismo Pilates serían 6 pastillas).
  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>(weekDates.map((d) => [d, []]));
    for (const a of turnosDeLaSemana ?? []) {
      if (a.activityId || a.trainingSessionId || !isVisible(a)) continue;
      if (prestadorasVisibles && !(a.providerId && prestadorasVisibles.includes(a.providerId))) continue;
      map.get(isoToLocalDate(a.appointmentStart))?.push(a);
    }
    return map;
  }, [weekDates, turnosDeLaSemana, prestadorasVisibles]);

  useEffect(() => { saveView("semana"); }, []);

  const totalMinWidth = TIME_COL_W + 6 * DAY_COL_MIN;

  function navigateWeek(n: -1 | 1) {
    setSearchParams(
      (params) => {
        params.set("date", addDays(anchorDate, n * 7));
        return params;
      },
      { replace: true },
    );
  }

  function goToDay(dateStr: string, turnoId?: string) {
    navigate(rutaConservando("/dia", searchParams, turnoId ? { date: dateStr, turno: turnoId } : { date: dateStr }));
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">

      {/* ── Barra ── */}
      <BarraAgenda
        vista="semana"
        cargando={isLoading || cargandoHuecos}
        fecha={
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-1.5 rounded hover:bg-surface text-ink-soft hover:text-ink transition-colors"
              aria-label="Semana anterior"
            >
              ‹
            </button>
            <span className="text-xl font-semibold min-w-56 text-center">
              {formatDate(monday)} – {formatDate(weekDates[5]!)}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="p-1.5 rounded hover:bg-surface text-ink-soft hover:text-ink transition-colors"
              aria-label="Semana siguiente"
            >
              ›
            </button>
          </div>
        }
        buscador={<BuscadorAgenda />}
      />

      <FiltrosAgenda />
      {falloHuecos && <p className="shrink-0 text-sm text-red-700">No se pudo consultar la disponibilidad. Probá de nuevo.</p>}
      {sinLugar && (
        <div className="flex shrink-0 items-center gap-3 text-sm text-ink-soft">
          <span>
            {serviciosIds.length === 1
              ? `No hay lugar para ${nombreDelServicio(serviciosIds[0]!)} esta semana.`
              : "No hay lugar para esos servicios esta semana."}
          </span>
          <button
            type="button"
            onClick={() => navigate(rutaConservando("/mes", searchParams, { date: anchorDate }))}
            className="rounded-lg border border-surface-highest px-3 py-1 text-ink hover:bg-surface-low"
          >
            Ver el mes
          </button>
        </div>
      )}

      {/* ── Grid semanal ── */}
      <div className="modal-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-xl border border-surface-high">
        <div style={{ minWidth: totalMinWidth }}>

          {/* Header de días — sticky top */}
          <div style={{ position: "sticky", top: 0, zIndex: 20, background: "white" }}>
            <div className="flex border-b border-surface-high shadow-sm">
              {/* Corner vacío alineado con la columna de horas */}
              <div
                className="shrink-0 bg-white"
                style={{ width: TIME_COL_W, position: "sticky", left: 0, zIndex: 30 }}
              />
              {weekDates.map((d) => {
                const dow     = new Date(`${d}T12:00:00Z`).getUTCDay();
                const isToday = d === today;
                return (
                  <div
                    key={d}
                    className="flex-1 border-l border-surface-high text-center py-1.5 cursor-pointer hover:bg-surface-low"
                    style={{ minWidth: DAY_COL_MIN }}
                    onClick={() => goToDay(d)}
                  >
                    <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-ink-soft"}`}>
                      {DAY_LABELS[dow]}
                    </span>
                    <span
                      className={[
                        "ml-1 text-sm font-semibold",
                        isToday
                          ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white"
                          : "text-ink",
                      ].join(" ")}
                    >
                      {new Date(`${d}T12:00:00Z`).getUTCDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Cuerpo del grid ── */}
          <div className="flex" style={{ height: TOTAL_PX }}>

            {/* Columna de horas — sticky left */}
            <div
              className="shrink-0 border-r border-surface-high bg-white"
              style={{ width: TIME_COL_W, position: "sticky", left: 0, zIndex: 10 }}
            >
              {SLOTS.map((s) => (
                <div
                  key={s}
                  className="flex items-start justify-end pr-2 text-[10px] text-ink-soft select-none"
                  style={{ height: SLOT_PX }}
                >
                  {minToLabel(s)}
                </div>
              ))}
            </div>

            {/* Una columna por día */}
            {weekDates.map((d) => {
              const dow       = new Date(`${d}T12:00:00Z`).getUTCDay();
              const dayConfig = openHours.find((h) => h.dayOfWeek === dow);
              const openMin   = dayConfig?.isOpen ? timeStrToMin(dayConfig.openingTime) : null;
              const closeMin  = dayConfig?.isOpen ? timeStrToMin(dayConfig.closingTime) : null;

              const dayAppts = apptsByDate.get(d) ?? [];
              const lugares  = carriles(
                dayAppts.map((a) => {
                  const inicio = isoToLocalMinutes(a.appointmentStart);
                  return { id: a.id, inicio, fin: inicio + (a.durationMinutes ?? SLOT_MIN) };
                }),
              );

              return (
                <div
                  key={d}
                  className="relative flex-1 border-l border-surface-high"
                  style={{ minWidth: DAY_COL_MIN, height: TOTAL_PX }}
                >
                  {/* Fondos de slots (abierto / cerrado) */}
                  {SLOTS.map((s) => {
                    const closed = openMin === null || closeMin === null
                      || s < openMin || s >= closeMin;
                    const pasado = yaPaso(d, s);
                    const tipo   = tipoDeHueco({ cerrado: closed, noAtiende: false, pasado });
                    const fondo  = FONDO_DEL_HUECO[tipo];
                    return (
                      <div
                        key={s}
                        data-testid={`slot-${d}-${s}`}
                        data-hueco={tipo}
                        className={[
                          "absolute w-full border-b border-surface-high transition-colors",
                          "flex items-center justify-center",
                          fondo.className,
                          pasado
                            ? "cursor-not-allowed"
                            : closed
                              ? "hover:bg-surface-highest cursor-pointer"
                              : "hover:bg-surface-low cursor-pointer",
                        ].join(" ")}
                        style={{ top: (s - START_MIN) * PX_PER_MIN, height: SLOT_PX, ...fondo.style }}
                        onClick={pasado || buscaLugar ? undefined : () => openNewAppt(d, s)}
                        aria-disabled={pasado || undefined}
                      >
                        {!pasado && !buscaLugar && (
                          <span className="text-sm font-light text-gray-200 select-none pointer-events-none">
                            +
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Pastillas de turnos (apagadas si se busca lugar: los huecos son lo que se toca) */}
                  <div
                    data-testid={`turnos-${d}`}
                    className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto"
                    style={buscaLugar ? { opacity: 0.35 } : undefined}
                  >
                  {dayAppts.map((appt) => {
                    const top  = (isoToLocalMinutes(appt.appointmentStart) - START_MIN) * PX_PER_MIN;
                    const alto = Math.max((appt.durationMinutes ?? SLOT_MIN) * PX_PER_MIN, 20);
                    if (top + alto <= 0 || top >= TOTAL_PX) return null;
                    const lugar = lugares.get(appt.id) ?? { carril: 0, total: 1 };
                    return (
                      <PastillaDeTurno
                        key={appt.id}
                        turno={appt}
                        color={colorMap.get(appt.providerId ?? "")}
                        carril={lugar.carril}
                        total={lugar.total}
                        top={top}
                        alto={alto}
                        onAbrir={(t) => goToDay(d, t.id)}
                      />
                    );
                  })}
                  </div>

                  {/* Huecos libres del servicio buscado, un carril por prestadora */}
                  {huecos.filter((h) => h.dia === d).map((h) => {
                    const top = (h.minutos - START_MIN) * PX_PER_MIN;
                    if (top < 0 || top >= TOTAL_PX) return null;
                    return (
                      <HuecoLibre
                        key={`${h.minutos}-${h.providerId}-${h.serviceId}`}
                        minutos={h.minutos}
                        providerName={h.providerName}
                        servicioNombre={serviciosIds.length > 1 ? nombreDelServicio(h.serviceId) : undefined}
                        color={colorMap.get(h.providerId)}
                        carril={Math.max(carrilesDeHuecos.indexOf(`${h.providerId}|${h.serviceId}`), 0)}
                        total={Math.max(carrilesDeHuecos.length, 1)}
                        top={top}
                        alto={PASO_HUECO_MIN * PX_PER_MIN}
                        onElegir={() => openNewAppt(d, h.minutos, {
                          serviceId: h.serviceId,
                          providerId: h.providerId,
                          providerName: h.providerName,
                        })}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {newApptOpen && (
        <NuevoTurnoModal
          date={newApptDate}
          prefill={newApptPrefill}
          onClose={() => setNewApptOpen(false)}
        />
      )}
    </div>
  );
}
