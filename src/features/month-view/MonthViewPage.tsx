import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { rutaConservando } from "../../lib/ruta-agenda";
import { useQueries } from "@tanstack/react-query";
import { useCompanyConfig, useDiasConLugar, useDiasQueAtienden, useProviders, useProvidersByServices } from "../../api/agenda";
import { api } from "../../api/client";
import type { Appointment } from "../../api/types";
import { buildProviderColorMap } from "../../lib/colors";
import { todayLocal } from "../../lib/format";
import { diasDeLaGrilla, etiquetaDelMes, utcDate, ymd } from "../../lib/grillaDelMes";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { saveView } from "../../components/ViewTabs";
import { BarraAgenda } from "../barra/BarraAgenda";
import { BuscadorAgenda } from "../barra/BuscadorAgenda";
import { useBusquedaAgenda, usePrestadorasDeLaBusqueda } from "../../lib/busqueda-agenda";
import { FiltrosAgenda } from "../barra/FiltrosAgenda";
import { PuntoDeLaPrestadora } from "./PuntoDeLaPrestadora";

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

export function MonthViewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // El mes vive en la URL (como en Día y Semana): recargar o pasar a Semana lo conserva.
  const anchorDate = searchParams.get("date") ?? todayLocal();
  const setAnchorDate = (fecha: string) =>
    setSearchParams((params) => { params.set("date", fecha); return params; }, { replace: true });
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
  const { year, month0, days } = useMemo(() => diasDeLaGrilla(anchorDate), [anchorDate]);

  const monthLabel = useMemo(() => etiquetaDelMes(year, month0), [year, month0]);

  // ── Carga de turnos por día (cache compartida con Día/Semana) ──────────────
  const dayQueries = useQueries({
    queries: days.map((d) => ({
      queryKey: ["appointments", d],
      queryFn:  () => api<Appointment[]>(`/api/agenda/appointments?date=${d}`),
      staleTime: 30_000,
    })),
  });

  const isLoading = dayQueries.some((q) => q.isLoading);

  const prestadorasVisibles = usePrestadorasDeLaBusqueda();

  // Verde, según lo que se filtre:
  //  · servicios elegidos: los días con lugar (sólo en las prestadoras elegidas, si hay);
  //  · sólo prestadoras: los días en que alguna de ellas trabaja.
  const { busqueda } = useBusquedaAgenda();
  const { porServicio } = useProvidersByServices(busqueda.servicios);
  const paresConLugar = busqueda.servicios.flatMap((serviceId) =>
    (porServicio.get(serviceId) ?? [])
      .map((p) => p.id)
      .filter((id) => busqueda.prestadoras.length === 0 || busqueda.prestadoras.includes(id))
      .map((providerId) => ({ serviceId, providerId })),
  );
  const { dias: diasConLugar, cargando: cargandoLugar, fallo: falloLugar } = useDiasConLugar(
    paresConLugar,
    ymd(year, month0, 1).slice(0, 7),
  );
  const buscaLugar = busqueda.servicios.length > 0;
  const { dias: diasQueAtienden, cargando: cargandoHorario } = useDiasQueAtienden(
    days,
    !buscaLugar ? busqueda.prestadoras : [],
  );

  const statsByDate = useMemo(() => {
    const map = new Map<string, { count: number; providerIds: string[]; porPrestadora: Map<string, Appointment[]> }>();
    days.forEach((d, i) => {
      const appts = (dayQueries[i]?.data ?? [])
        .filter(isVisible)
        .filter((a) => !prestadorasVisibles || (a.providerId && prestadorasVisibles.includes(a.providerId)));
      const providerIds: string[] = [];
      const porPrestadora = new Map<string, Appointment[]>();
      for (const a of appts) {
        const pid = a.providerId ?? "";
        if (!pid) continue;
        if (!providerIds.includes(pid)) providerIds.push(pid);
        porPrestadora.set(pid, [...(porPrestadora.get(pid) ?? []), a]);
      }
      map.set(d, { count: appts.length, providerIds, porPrestadora });
    });
    return map;
  }, [days, dayQueries, prestadorasVisibles]);

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

      {/* ── Barra ── */}
      <BarraAgenda
        vista="mes"
        cargando={isLoading || cargandoLugar || cargandoHorario}
        fecha={
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
        }
        buscador={<BuscadorAgenda />}
      />

      <FiltrosAgenda />
      {falloLugar && <p className="shrink-0 text-sm text-red-700">No se pudo consultar la disponibilidad. Probá de nuevo.</p>}

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
            const conLugar = inMonth && buscaLugar && diasConLugar.has(d);
            const atiende = inMonth && !buscaLugar && diasQueAtienden.has(d);
            const verde   = conLugar || atiende;

            return (
              <button
                key={d}
                data-dia={d}
                data-lugar={conLugar ? "si" : undefined}
                data-atiende={atiende ? "si" : undefined}
                onClick={() => navigate(rutaConservando(conLugar ? "/semana" : "/dia", searchParams, { date: d }))}
                className={[
                  "relative flex flex-col items-start gap-1 border-b border-l border-surface-high p-1.5 text-left transition-colors",
                  verde ? "bg-emerald-100 hover:bg-emerald-200" : closed ? "bg-surface-high/50 hover:bg-surface-low" : "bg-white hover:bg-surface-low",
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
                        <PuntoDeLaPrestadora
                          key={pid}
                          dia={d}
                          providerId={pid}
                          providerName={providers.find((p) => p.id === pid)?.fullName ?? "Prestadora"}
                          color={colorMap.get(pid)}
                          turnos={stats?.porPrestadora.get(pid) ?? []}
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
