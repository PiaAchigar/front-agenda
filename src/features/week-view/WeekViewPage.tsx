import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { rutaConservando } from "../../lib/ruta-agenda";
import { useAppointmentsRange, useCompanyConfig, useProviders } from "../../api/agenda";
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
import { usePrestadorasDeLaBusqueda } from "../../lib/busqueda-agenda";
import { PastillaDeTurno } from "./PastillaDeTurno";
import { NewAppointmentModal, type NewApptPrefill } from "../day-view/NewAppointmentModal";

// ── Constantes del grid ──────────────────────────────────────────────────────
const PX_PER_MIN       = 2;
const START_MIN        = 8  * 60;   // 480
const END_MIN          = 22 * 60;   // 1320
const SLOT_MIN         = 30;
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

  function openNewAppt(date: string, minutes: number) {
    setNewApptDate(date);
    setNewApptPrefill({ minutes });
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
        cargando={isLoading}
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
                        onClick={pasado ? undefined : () => openNewAppt(d, s)}
                        aria-disabled={pasado || undefined}
                      >
                        {!pasado && (
                          <span className="text-sm font-light text-gray-200 select-none pointer-events-none">
                            +
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Pastillas de turnos */}
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
              );
            })}
          </div>
        </div>
      </div>
      {newApptOpen && (
        <NewAppointmentModal
          open
          date={newApptDate}
          prefill={newApptPrefill}
          onClose={() => setNewApptOpen(false)}
        />
      )}
    </div>
  );
}
