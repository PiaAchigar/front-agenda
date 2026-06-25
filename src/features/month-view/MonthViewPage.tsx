import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { useCompanyConfig, useProviders } from "../../api/agenda";
import { api } from "../../api/client";
import type { Appointment } from "../../api/types";
import { buildProviderColorMap } from "../../lib/colors";
import { addDays, todayLocal } from "../../lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ViewTabs, saveView } from "../../components/ViewTabs";
import { Spinner } from "../../components/ui";

/** Reservas expiradas se tratan como canceladas hasta que el cron las limpie. */
function isVisible(appt: { status: string | null; reservationExpiresAt: string | null }): boolean {
  if (appt.status === "cancelled") return false;
  if (appt.status === "reserved" && appt.reservationExpiresAt) {
    return new Date(appt.reservationExpiresAt) > new Date();
  }
  return true;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_DOTS = 4;

function ymd(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

export function MonthViewPage() {
  const navigate = useNavigate();
  const [anchorDate, setAnchorDate] = useState(todayLocal);
  const today = todayLocal();

  useEffect(() => { saveView("mes"); }, []);

  const { data: providers = [] } = useProviders();
  const { data: config }         = useCompanyConfig();
  const openHours                = config?.openHours ?? [];

  const colorMap = useMemo(
    () => buildProviderColorMap(providers.map((p) => p.id)),
    [providers],
  );

  // ── Geometría del mes (grilla Lun → Dom, semanas completas) ────────────────
  const { year, month0, days } = useMemo(() => {
    const base   = utcDate(anchorDate);
    const year   = base.getUTCFullYear();
    const month0 = base.getUTCMonth();
    const firstOfMonth = ymd(year, month0, 1);
    const firstDow     = utcDate(firstOfMonth).getUTCDay();        // 0=Dom … 6=Sáb
    const leading      = firstDow === 0 ? 6 : firstDow - 1;        // offset hacia el lunes
    const daysInMonth  = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
    const weeks        = Math.ceil((leading + daysInMonth) / 7);
    const gridStart    = addDays(firstOfMonth, -leading);
    const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
    return { year, month0, days };
  }, [anchorDate]);

  const monthLabel = useMemo(() => {
    const raw = utcDate(ymd(year, month0, 1)).toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [year, month0]);

  // ── Carga de turnos por día (cache compartida con Día/Semana) ──────────────
  const dayQueries = useQueries({
    queries: days.map((d) => ({
      queryKey: ["appointments", d],
      queryFn:  () => api<Appointment[]>(`/api/agenda/appointments?date=${d}`),
      staleTime: 30_000,
    })),
  });

  const isLoading = dayQueries.some((q) => q.isLoading);

  const statsByDate = useMemo(() => {
    const map = new Map<string, { count: number; providerIds: string[] }>();
    days.forEach((d, i) => {
      const appts = (dayQueries[i]?.data ?? []).filter(isVisible);
      const providerIds: string[] = [];
      for (const a of appts) {
        const pid = a.providerId ?? "";
        if (pid && !providerIds.includes(pid)) providerIds.push(pid);
      }
      map.set(d, { count: appts.length, providerIds });
    });
    return map;
  }, [days, dayQueries]);

  function navigateMonth(n: -1 | 1) {
    const d = new Date(Date.UTC(year, month0 + n, 1));
    setAnchorDate(ymd(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  function isClosed(dateStr: string): boolean {
    const dow = utcDate(dateStr).getUTCDay();
    const cfg = openHours.find((h) => h.dayOfWeek === dow);
    return !cfg?.isOpen;
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateMonth(-1)}
            className="group p-1.5 rounded hover:bg-surface-low transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} className="text-ink-soft group-hover:text-primary transition-colors" />
          </button>
          <span className="text-xl font-semibold min-w-44 text-center">{monthLabel}</span>
          <button
            onClick={() => navigateMonth(1)}
            className="group p-1.5 rounded hover:bg-surface-low transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} className="text-ink-soft group-hover:text-primary transition-colors" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Spinner />}
          <ViewTabs current="mes" />
        </div>
      </div>

      {/* ── Calendario ── */}
      <div className="modal-scroll flex-1 min-h-0 overflow-auto rounded-xl border border-surface-high">
        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 border-b border-surface-high bg-white sticky top-0 z-10">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`py-2 text-center text-xs font-semibold ${
                i === 6 ? "text-ink-soft" : "text-ink"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Celdas de días */}
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,1fr)]">
          {days.map((d) => {
            const cell    = utcDate(d);
            const inMonth = cell.getUTCMonth() === month0;
            const isToday = d === today;
            const closed  = isClosed(d);
            const stats   = statsByDate.get(d);
            const dayNum  = cell.getUTCDate();
            const dots    = stats?.providerIds ?? [];
            const extra   = dots.length - MAX_DOTS;

            return (
              <button
                key={d}
                onClick={() => navigate(`/dia?date=${d}`)}
                className={[
                  "relative flex flex-col items-start gap-1 border-b border-l border-surface-high p-1.5 text-left transition-colors hover:bg-surface-low",
                  closed ? "bg-surface-high/50" : "bg-white",
                  inMonth ? "" : "opacity-40",
                ].join(" ")}
              >
                {/* Número de día */}
                <span
                  className={[
                    "text-xs font-semibold leading-none",
                    isToday
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"
                      : inMonth
                        ? "text-ink"
                        : "text-ink-soft",
                  ].join(" ")}
                >
                  {dayNum}
                </span>

                {/* Conteo + puntitos por prestadora */}
                {stats && stats.count > 0 && (
                  <div className="mt-auto flex w-full flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-0.5">
                      {dots.slice(0, MAX_DOTS).map((pid) => (
                        <span
                          key={pid}
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: colorMap.get(pid)?.bg ?? "#cbd5e1" }}
                        />
                      ))}
                      {extra > 0 && (
                        <span className="text-[9px] leading-none text-ink-soft">+{extra}</span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-none text-ink-soft">
                      {stats.count} {stats.count === 1 ? "turno" : "turnos"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
