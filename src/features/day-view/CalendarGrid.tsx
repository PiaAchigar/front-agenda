import { useMemo } from "react";
import type { Appointment } from "../../api/types";
import { buildProviderColorMap, STATUS_BORDER_COLOR } from "../../lib/colors";
import { formatTime, isoToLocalMinutes } from "../../lib/format";

// ── Constantes del grid ──────────────────────────────────────────────────────
const PX_PER_MIN = 2;
const START_MIN  = 8  * 60; // 480  — 08:00
const END_MIN    = 22 * 60; // 1320 — 22:00
const SLOT_MIN   = 30;
const SLOT_PX    = SLOT_MIN * PX_PER_MIN; // 60 px
const TOTAL_PX   = (END_MIN - START_MIN) * PX_PER_MIN; // 1680 px
const TIME_COL_W = 64;  // px — columna de horas
const COL_MIN_W  = 220; // px — ancho mínimo por columna de contenido

const SLOTS = Array.from(
  { length: (END_MIN - START_MIN) / SLOT_MIN },
  (_, i) => START_MIN + i * SLOT_MIN,
);

function minToLabel(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function timeStrToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

// ── Tipos ────────────────────────────────────────────────────────────────────
export type ColumnMode = "provider" | "service";

type OpenHour = {
  dayOfWeek: number | null;
  openingTime: string | null;
  closingTime: string | null;
  isOpen: boolean | null;
};

export type ProviderCol = { id: string; name: string };

type Props = {
  appointments: Appointment[];
  providers: ProviderCol[];
  date: string;
  openHours: OpenHour[];
  columnMode: ColumnMode;
  /** Clase CSS extra para controlar la altura desde el padre (ej: "flex-1 min-h-0"). */
  className?: string;
  onAppointmentClick: (appt: Appointment) => void;
  /** columnId = providerId en modo "provider", serviceId en modo "service". */
  onSlotClick: (columnId: string, minutes: number) => void;
};

// ── Componente ───────────────────────────────────────────────────────────────
export function CalendarGrid({
  appointments,
  providers,
  date,
  openHours,
  columnMode,
  className = "",
  onAppointmentClick,
  onSlotClick,
}: Props) {
  // Colores siempre por providerId
  const colorMap = useMemo(
    () => buildProviderColorMap(providers.map((p) => p.id)),
    [providers],
  );

  // Horario de apertura / cierre del día actual
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayConfig  = openHours.find((h) => h.dayOfWeek === dayOfWeek);
  const openMin    = dayConfig?.isOpen ? timeStrToMin(dayConfig.openingTime)  : null;
  const closeMin   = dayConfig?.isOpen ? timeStrToMin(dayConfig.closingTime)  : null;

  // ── Columnas según modo ──────────────────────────────────────────────────
  const columns = useMemo(() => {
    if (columnMode === "provider") return providers;
    const seen = new Map<string, string>();
    for (const appt of appointments) {
      if (appt.serviceId && appt.serviceName && !seen.has(appt.serviceId)) {
        seen.set(appt.serviceId, appt.serviceName);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [columnMode, providers, appointments]);

  // ── Turnos agrupados por columna ─────────────────────────────────────────
  const byColumn = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const key = columnMode === "provider"
        ? (appt.providerId ?? "__unassigned")
        : (appt.serviceId  ?? "__unknown");
      const list = map.get(key) ?? [];
      list.push(appt);
      map.set(key, list);
    }
    return map;
  }, [appointments, columnMode]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function isClosedSlot(slotMin: number): boolean {
    if (openMin === null || closeMin === null) return true;
    return slotMin < openMin || slotMin >= closeMin;
  }

  function cardTopPx(iso: string): number {
    return (isoToLocalMinutes(iso) - START_MIN) * PX_PER_MIN;
  }

  function cardHeightPx(appt: Appointment): number {
    return Math.max((appt.durationMinutes ?? SLOT_MIN) * PX_PER_MIN, 24);
  }

  const totalMinWidth = TIME_COL_W + columns.length * COL_MIN_W;

  return (
    /*
     * Layout: UN ÚNICO contenedor con overflow-y-auto overflow-x-auto.
     * El header de columnas vive DENTRO con sticky top-0 para que scrollee
     * horizontalmente con el contenido y quede fijo al hacer scroll vertical.
     * La columna de horas usa sticky left-0 para quedar fija en scroll horizontal.
     * El corner (top-left) usa sticky top-0 + left-0 para quedar fijo siempre.
     */
    <div
      className={`overflow-y-auto overflow-x-auto rounded-xl border border-surface-high ${className}`}
    >
      <div style={{ minWidth: totalMinWidth }}>

        {/* ── Header sticky-top ────────────────────────────────────────── */}
        <div
          className="flex border-b border-surface-high bg-white shadow-sm"
          style={{ position: "sticky", top: 0, zIndex: 20 }}
        >
          {/* Corner: sticky top + left */}
          <div
            className="shrink-0 bg-white"
            style={{
              width: TIME_COL_W,
              position: "sticky",
              left: 0,
              zIndex: 30,
            }}
          />
          {/* Nombres de columnas */}
          {columns.map((col) => {
            const color = columnMode === "provider" ? colorMap.get(col.id) : undefined;
            return (
              <div
                key={col.id}
                className="border-l border-surface-high py-2 text-center text-sm font-semibold truncate px-1"
                style={{ flex: 1, minWidth: COL_MIN_W, color: color?.text ?? "#374151" }}
              >
                {col.name}
              </div>
            );
          })}
        </div>

        {/* ── Contenido del grid ───────────────────────────────────────── */}
        <div className="flex" style={{ height: TOTAL_PX }}>

          {/* Columna de horas — sticky left */}
          <div
            className="shrink-0 border-r border-surface-high bg-white"
            style={{ width: TIME_COL_W, position: "sticky", left: 0, zIndex: 10 }}
          >
            {SLOTS.map((slotMin) => (
              <div
                key={slotMin}
                className="flex items-start justify-end pr-2 text-[10px] text-ink-soft select-none"
                style={{ height: SLOT_PX }}
              >
                {minToLabel(slotMin)}
              </div>
            ))}
          </div>

          {/* Columnas de contenido */}
          {columns.map((col) => {
            const appts = byColumn.get(col.id) ?? [];

            return (
              <div
                key={col.id}
                className="relative border-l border-surface-high"
                style={{ flex: 1, minWidth: COL_MIN_W, height: TOTAL_PX }}
              >
                {/* Fondos de slots + zona clickeable */}
                {SLOTS.map((slotMin) => (
                  <div
                    key={slotMin}
                    className={[
                      "absolute w-full border-b border-surface-high cursor-pointer transition-colors",
                      isClosedSlot(slotMin)
                        ? "bg-surface-high hover:bg-surface-highest"
                        : "bg-white hover:bg-surface-low",
                    ].join(" ")}
                    style={{ top: (slotMin - START_MIN) * PX_PER_MIN, height: SLOT_PX }}
                    onClick={() => onSlotClick(col.id, slotMin)}
                  />
                ))}

                {/* Cards de turnos */}
                {appts.map((appt) => {
                  const top    = cardTopPx(appt.appointmentStart);
                  const height = cardHeightPx(appt);
                  if (top + height <= 0 || top >= TOTAL_PX) return null;

                  const color       = colorMap.get(appt.providerId ?? "");
                  const borderColor = STATUS_BORDER_COLOR[appt.status ?? "scheduled"]
                    ?? STATUS_BORDER_COLOR.scheduled;
                  const isCancelled = appt.status === "cancelled";
                  const cardSubtext = columnMode === "provider"
                    ? appt.serviceName
                    : appt.providerName;

                  return (
                    <button
                      key={appt.id}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick(appt); }}
                      className={[
                        "absolute left-0.5 right-0.5 rounded text-left text-[11px]",
                        "overflow-hidden shadow-sm hover:shadow-md transition-shadow z-10 px-1.5 py-0.5",
                        isCancelled ? "opacity-50" : "",
                      ].join(" ")}
                      style={{
                        top,
                        height,
                        backgroundColor: color?.bg ?? "#e5e7eb",
                        color:           color?.text ?? "#374151",
                        borderLeft:      `4px solid ${borderColor}`,
                      }}
                    >
                      <p className="font-semibold truncate leading-tight">
                        {formatTime(appt.appointmentStart)}{" "}
                        <span className={isCancelled ? "line-through" : ""}>
                          {appt.customerName ?? "Cliente"}
                        </span>
                      </p>
                      {height >= 44 && (
                        <p className="truncate opacity-80">{cardSubtext}</p>
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
  );
}
