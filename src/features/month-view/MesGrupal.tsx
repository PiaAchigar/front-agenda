import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClassesRange } from "../../api/grupal";
import type { ClassOccurrence } from "../../api/types";
import { claseVisible, hayFiltrosGrupales, useBusquedaGrupal } from "../../lib/busqueda-grupal";
import { estadoDeClase } from "../../lib/estado-de-clase";
import { todayLocal } from "../../lib/format";
import { diasDeLaGrilla, utcDate } from "../../lib/grillaDelMes";
import { rutaConservando } from "../../lib/ruta-agenda";
import { WEEKDAY_LABELS } from "./grilla-mes";
import { PuntoDeClase } from "./PuntoDeClase";

const MAX_PUNTOS = 8;

/** El mes de las clases (actividades y capacitaciones): la misma grilla que el mes individual. */
export function MesGrupal({ anchorDate }: { anchorDate: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { busqueda } = useBusquedaGrupal();
  const { month0, days } = useMemo(() => diasDeLaGrilla(anchorDate), [anchorDate]);
  const today = todayLocal();
  const { data: clases, error } = useClassesRange(days[0]!, days[days.length - 1]!);
  const ahora = new Date();
  const hayFiltro = hayFiltrosGrupales(busqueda);

  const porDia = useMemo(() => {
    const mapa = new Map(days.map((d) => [d, [] as ClassOccurrence[]]));
    for (const c of clases ?? []) if (claseVisible(c, busqueda)) mapa.get(c.date)?.push(c);
    for (const lista of mapa.values()) lista.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return mapa;
  }, [days, clases, busqueda]);

  return (
    <>
      {error && <p className="shrink-0 text-sm text-red-700">No se pudieron cargar las clases. Probá de nuevo.</p>}
      <div className="modal-scroll flex-1 min-h-0 overflow-auto rounded-xl border border-surface-high">
        <div className="grid grid-cols-7 border-b border-surface-high bg-white sticky top-0 z-10">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={label} className={`py-2 text-center text-xs font-semibold ${i === 6 ? "text-ink-soft" : "text-ink"}`}>
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(120px,1fr)]">
          {days.map((d) => {
            const cell = utcDate(d);
            const inMonth = cell.getUTCMonth() === month0;
            const isToday = d === today;
            const delDia = porDia.get(d) ?? [];
            const extra = delDia.length - MAX_PUNTOS;
            const conLugar = inMonth && hayFiltro && delDia.some((c) => estadoDeClase(c, ahora) === "con-lugar");

            return (
              <button
                key={d}
                type="button"
                data-testid={`dia-${d}`}
                data-dia={d}
                data-lugar={conLugar ? "si" : undefined}
                onClick={() => navigate(rutaConservando("/dia", searchParams, { date: d }))}
                className={[
                  "relative flex flex-col items-start gap-1 border-b border-l border-surface-high p-1.5 text-left transition-colors",
                  conLugar ? "bg-emerald-100 hover:bg-emerald-200" : "bg-white hover:bg-surface-low",
                  inMonth ? "" : "opacity-40",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-xs font-semibold leading-none",
                    isToday
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"
                      : inMonth ? "text-ink" : "text-ink-soft",
                  ].join(" ")}
                >
                  {cell.getUTCDate()}
                </span>

                {delDia.length > 0 && (
                  <div className="mt-auto flex w-full flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-0.5">
                      {delDia.slice(0, MAX_PUNTOS).map((c) => (
                        <PuntoDeClase key={c.occurrenceId} clase={c} estado={estadoDeClase(c, ahora)} />
                      ))}
                      {extra > 0 && <span className="text-[9px] leading-none text-ink-soft">+{extra}</span>}
                    </div>
                    <span className="text-[10px] font-medium leading-none text-ink-soft">
                      {delDia.length} {delDia.length === 1 ? "clase" : "clases"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
