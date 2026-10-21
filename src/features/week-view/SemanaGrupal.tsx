import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClassesRange } from "../../api/grupal";
import { claseVisible, useBusquedaGrupal } from "../../lib/busqueda-grupal";
import { carriles } from "../../lib/carriles";
import { addDays, todayLocal } from "../../lib/format";
import { rutaConservando } from "../../lib/ruta-agenda";
import {
  DAY_COL_MIN, DAY_LABELS, PX_PER_MIN, SLOT_PX, SLOTS, START_MIN, TIME_COL_W, TOTAL_PX,
  minToLabel, timeStrToMin, weekStart,
} from "./grilla-semana";
import { PastillaDeClase } from "./PastillaDeClase";

/** La semana de las clases (actividades y capacitaciones): misma grilla que la de turnos. */
export function SemanaGrupal({ anchorDate }: { anchorDate: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { busqueda } = useBusquedaGrupal();
  const monday = useMemo(() => weekStart(anchorDate), [anchorDate]);
  const weekDates = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(monday, i)), [monday]);
  const today = todayLocal();
  const { data: clases, isLoading, error } = useClassesRange(weekDates[0]!, weekDates[5]!);
  const ahora = new Date();

  const porDia = useMemo(() => {
    const mapa = new Map(weekDates.map((d) => [d, [] as NonNullable<typeof clases>]));
    for (const c of clases ?? []) if (claseVisible(c, busqueda)) mapa.get(c.date)?.push(c);
    return mapa;
  }, [weekDates, clases, busqueda]);

  const irAlDia = (date: string) => navigate(rutaConservando("/dia", searchParams, { date }));

  return (
    <>
      {error && <p className="shrink-0 text-sm text-red-700">No se pudieron cargar las clases. Probá de nuevo.</p>}
      {isLoading && <p className="shrink-0 text-sm text-ink-soft">Cargando clases…</p>}
      <div className="modal-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-xl border border-surface-high">
        <div style={{ minWidth: TIME_COL_W + 6 * DAY_COL_MIN }}>
          <div style={{ position: "sticky", top: 0, zIndex: 20, background: "white" }}>
            <div className="flex border-b border-surface-high shadow-sm">
              <div className="shrink-0 bg-white" style={{ width: TIME_COL_W, position: "sticky", left: 0, zIndex: 30 }} />
              {weekDates.map((d) => {
                const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
                const esHoy = d === today;
                return (
                  <div
                    key={d}
                    className="flex-1 cursor-pointer border-l border-surface-high py-1.5 text-center hover:bg-surface-low"
                    style={{ minWidth: DAY_COL_MIN }}
                    onClick={() => irAlDia(d)}
                  >
                    <span className={`text-xs font-medium ${esHoy ? "text-primary" : "text-ink-soft"}`}>{DAY_LABELS[dow]}</span>
                    <span
                      className={[
                        "ml-1 text-sm font-semibold",
                        esHoy ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white" : "text-ink",
                      ].join(" ")}
                    >
                      {new Date(`${d}T12:00:00Z`).getUTCDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex" style={{ height: TOTAL_PX }}>
            <div
              className="shrink-0 border-r border-surface-high bg-white"
              style={{ width: TIME_COL_W, position: "sticky", left: 0, zIndex: 10 }}
            >
              {SLOTS.map((s) => (
                <div key={s} className="flex select-none items-start justify-end pr-2 text-[10px] text-ink-soft" style={{ height: SLOT_PX }}>
                  {minToLabel(s)}
                </div>
              ))}
            </div>

            {weekDates.map((d) => {
              const delDia = (porDia.get(d) ?? []).flatMap((c) => {
                const inicio = timeStrToMin(c.startTime);
                const fin = timeStrToMin(c.endTime);
                return inicio === null || fin === null ? [] : [{ c, inicio, fin }];
              });
              const lugares = carriles(delDia.map(({ c, inicio, fin }) => ({ id: c.occurrenceId, inicio, fin })));
              return (
                <div
                  key={d}
                  data-testid={`clases-${d}`}
                  className="relative flex-1 border-l border-surface-high"
                  style={{ minWidth: DAY_COL_MIN, height: TOTAL_PX }}
                >
                  {SLOTS.map((s) => (
                    <div
                      key={s}
                      className="absolute w-full border-b border-surface-high"
                      style={{ top: (s - START_MIN) * PX_PER_MIN, height: SLOT_PX }}
                    />
                  ))}
                  {delDia.map(({ c, inicio, fin }) => {
                    const top = (inicio - START_MIN) * PX_PER_MIN;
                    const alto = Math.max((fin - inicio) * PX_PER_MIN, 20);
                    if (top + alto <= 0 || top >= TOTAL_PX) return null;
                    const lugar = lugares.get(c.occurrenceId) ?? { carril: 0, total: 1 };
                    return (
                      <PastillaDeClase
                        key={c.occurrenceId}
                        clase={c}
                        ahora={ahora}
                        carril={lugar.carril}
                        total={lugar.total}
                        top={top}
                        alto={alto}
                        onAbrir={() => irAlDia(d)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
