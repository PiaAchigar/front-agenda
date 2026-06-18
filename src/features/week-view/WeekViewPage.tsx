import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { useCompanyConfig, useProviders } from "../../api/agenda";
import { api } from "../../api/client";
import type { Appointment } from "../../api/types";
import { buildProviderColorMap, STATUS_BORDER_COLOR } from "../../lib/colors";
import { addDays, formatDate, formatTime, isoToLocalMinutes, todayLocal } from "../../lib/format";
import { ViewTabs, saveView } from "../../components/ViewTabs";
import { Spinner } from "../../components/ui";

// ── Constantes del grid ──────────────────────────────────────────────────────
const PX_PER_MIN       = 2;
const START_MIN        = 8  * 60;   // 480
const END_MIN          = 22 * 60;   // 1320
const SLOT_MIN         = 30;
const SLOT_PX          = SLOT_MIN * PX_PER_MIN;          // 60 px
const TOTAL_PX         = (END_MIN - START_MIN) * PX_PER_MIN; // 1680 px
const TIME_COL_W       = 64;
const DAY_COL_MIN      = 140;       // px mínimos por columna de día
const OVERLAP_OFFSET   = 8;         // px de desplazamiento horizontal por solapamiento

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

/**
 * Para cada appointment devuelve cuántos anteriores (ordenados por inicio)
 * se solapan con él, para calcular el offset horizontal de apilamiento.
 */
function computeOverlapOffsets(appts: Appointment[]): Map<string, number> {
  const sorted = [...appts].sort(
    (a, b) => new Date(a.appointmentStart).getTime() - new Date(b.appointmentStart).getTime(),
  );
  const offsets = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const curr      = sorted[i]!;
    const currStart = isoToLocalMinutes(curr.appointmentStart);
    let overlapCount = 0;
    for (let j = 0; j < i; j++) {
      const prev    = sorted[j]!;
      const prevEnd = isoToLocalMinutes(prev.appointmentStart) + (prev.durationMinutes ?? SLOT_MIN);
      if (prevEnd > currStart) overlapCount++;
    }
    offsets.set(curr.id, overlapCount);
  }
  return offsets;
}

// ── Componente ───────────────────────────────────────────────────────────────
export function WeekViewPage() {
  const navigate    = useNavigate();
  const [anchorDate, setAnchorDate] = useState(todayLocal);

  // Bug fix: memoizar monday y weekDates para que no se recreen en cada render,
  // evitando que apptsByDate recalcule innecesariamente.
  const monday    = useMemo(() => weekStart(anchorDate), [anchorDate]);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
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

  // Cargar turnos de los 7 días en paralelo
  const weekQueries = useQueries({
    queries: weekDates.map((d) => ({
      queryKey: ["appointments", d],
      queryFn:  () => api<Appointment[]>(`/api/agenda/appointments?date=${d}`),
      staleTime: 30_000,
    })),
  });

  const isLoading = weekQueries.some((q) => q.isLoading);

  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    weekDates.forEach((d, i) => {
      map.set(d, weekQueries[i]?.data ?? []);
    });
    return map;
  }, [weekDates, weekQueries]);

  useEffect(() => { saveView("semana"); }, []);

  const totalMinWidth = TIME_COL_W + 7 * DAY_COL_MIN;

  function navigateWeek(n: -1 | 1) {
    setAnchorDate((d) => addDays(d, n * 7));
  }

  function goToDay(dateStr: string) {
    navigate(`/dia?date=${dateStr}`);
  }

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 100px)" }}>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateWeek(-1)}
            className="p-1.5 rounded hover:bg-surface text-ink-soft hover:text-ink transition-colors"
            aria-label="Semana anterior"
          >
            ‹
          </button>
          <span className="text-xl font-semibold min-w-56 text-center">
            {formatDate(monday)} – {formatDate(weekDates[6]!)}
          </span>
          <button
            onClick={() => navigateWeek(1)}
            className="p-1.5 rounded hover:bg-surface text-ink-soft hover:text-ink transition-colors"
            aria-label="Semana siguiente"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Spinner />}
          <ViewTabs current="semana" />
        </div>
      </div>

      {/* ── Grid semanal ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-xl border border-surface-high">
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
              const offsets  = computeOverlapOffsets(dayAppts);

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
                    return (
                      <div
                        key={s}
                        className={[
                          "absolute w-full border-b border-surface-high",
                          closed ? "bg-surface-high" : "bg-white",
                        ].join(" ")}
                        style={{ top: (s - START_MIN) * PX_PER_MIN, height: SLOT_PX }}
                      />
                    );
                  })}

                  {/* Cards de turnos */}
                  {dayAppts.map((appt) => {
                    const top    = (isoToLocalMinutes(appt.appointmentStart) - START_MIN) * PX_PER_MIN;
                    const height = Math.max((appt.durationMinutes ?? SLOT_MIN) * PX_PER_MIN, 20);
                    if (top + height <= 0 || top >= TOTAL_PX) return null;

                    const overlapIdx  = offsets.get(appt.id) ?? 0;
                    const color       = colorMap.get(appt.providerId ?? "");
                    const borderColor = STATUS_BORDER_COLOR[appt.status ?? "scheduled"]
                      ?? STATUS_BORDER_COLOR.scheduled;
                    const isCancelled = appt.status === "cancelled";

                    const startLabel = formatTime(appt.appointmentStart);
                    const endLabel   = formatTime(appt.appointmentEnd);

                    return (
                      <button
                        key={appt.id}
                        onClick={() => goToDay(d)}
                        className={[
                          "absolute right-0.5 rounded text-left text-[10px]",
                          "overflow-hidden shadow-sm hover:shadow-md transition-shadow px-1 py-0.5",
                          isCancelled ? "opacity-40" : "",
                        ].join(" ")}
                        style={{
                          top,
                          height,
                          left:            overlapIdx * OVERLAP_OFFSET + 2,
                          zIndex:          10 + overlapIdx,
                          backgroundColor: color?.bg   ?? "#e5e7eb",
                          color:           color?.text ?? "#374151",
                          borderLeft:      `3px solid ${borderColor}`,
                        }}
                        title={`${appt.customerName ?? "Cliente"} · ${appt.serviceName} · ${appt.providerName} · ${startLabel}–${endLabel}`}
                      >
                        {/* Prioridad 1: cliente (siempre visible) */}
                        <span className={`font-semibold truncate block leading-tight ${isCancelled ? "line-through" : ""}`}>
                          {appt.customerName ?? "Cliente"}
                        </span>

                        {/* Prioridad 2: prestadora (si hay espacio mínimo) */}
                        {height >= 28 && (
                          <span className="truncate block leading-tight opacity-90">
                            {appt.providerName ?? ""}
                          </span>
                        )}

                        {/* Prioridad 3: servicio */}
                        {height >= 52 && (
                          <span className="truncate block leading-tight opacity-75">
                            {appt.serviceName}
                          </span>
                        )}

                        {/* Prioridad 4: horario inicio–fin */}
                        {height >= 68 && (
                          <span className="truncate block leading-tight opacity-70">
                            {startLabel}–{endLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
