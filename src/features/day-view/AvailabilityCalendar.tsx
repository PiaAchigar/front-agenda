import { ChevronLeft, ChevronRight } from "lucide-react";
import { diasDeLaGrilla, etiquetaDelMes, mesAnterior, mesSiguiente } from "../../lib/grillaDelMes";

const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Props = {
  month: string;
  selected: string | null;
  availableDays: ReadonlySet<string>;
  loading: boolean;
  hoy: string;
  onSelectDay: (date: string) => void;
  onMonthChange: (month: string) => void;
};

/**
 * Grilla mensual para elegir el día de un reagendado. Los días en que la
 * proveedora tiene hueco libre van en verde; el resto, apagado.
 *
 * Es de presentación pura: no pide datos, los recibe. Reemplaza al
 * `<input type="date">` nativo porque el calendario del navegador no se puede
 * pintar por día.
 */
export function AvailabilityCalendar({
  month,
  selected,
  availableDays,
  loading,
  hoy,
  onSelectDay,
  onMonthChange,
}: Props) {
  const { year, month0, days } = diasDeLaGrilla(`${month}-01`);
  // Antes del mes de hoy no hay nada que agendar.
  const puedeRetroceder = mesAnterior(month) >= hoy.slice(0, 7);

  return (
    <div className="rounded-xl border border-surface-highest bg-white p-3" aria-busy={loading}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          disabled={!puedeRetroceder}
          onClick={() => onMonthChange(mesAnterior(month))}
          className="rounded p-1.5 text-ink-soft hover:bg-surface-low disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-ink">{etiquetaDelMes(year, month0)}</span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => onMonthChange(mesSiguiente(month))}
          className="rounded p-1.5 text-ink-soft hover:bg-surface-low"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {SEMANA.map((d) => (
          <span key={d} className="pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            {d}
          </span>
        ))}
        {days.map((d) => {
          if (d.slice(0, 7) !== month) return <span key={d} />;
          const disponible = !loading && d >= hoy && availableDays.has(d);
          const elegido = d === selected;
          return (
            <button
              key={d}
              type="button"
              disabled={!disponible}
              data-disponible={disponible}
              aria-pressed={elegido}
              onClick={() => onSelectDay(d)}
              className={[
                "aspect-square rounded-lg text-sm transition-colors",
                elegido
                  ? "bg-primary font-semibold text-white"
                  : disponible
                    ? "bg-emerald-100 font-medium text-emerald-800 hover:bg-emerald-200"
                    : "text-ink-soft/40",
              ].join(" ")}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
