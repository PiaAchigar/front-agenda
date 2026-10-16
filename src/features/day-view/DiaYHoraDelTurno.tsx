import { useEffect, useRef, useState } from "react";
import { useAvailability, useMonthAvailability } from "../../api/agenda";
import { todayLocal } from "../../lib/format";
import { AVISO_HORARIO_PASADO, yaPaso } from "../../lib/horario";
import { primerDiaLibre } from "../../lib/primer-dia-libre";
import { minutosDe } from "../../lib/vender";
import { AvailabilityCalendar } from "./AvailabilityCalendar";

type Props = {
  serviceId: string | null;
  providerId: string | null;
  fecha: string;
  hora: string;
  /** Depilación: la duración la fijan las zonas, así que la hora se escribe libre. */
  horaLibre: boolean;
  /** Desde "A agendar": si no hay día, arranca en el primer día libre. */
  elegirPrimerDiaLibre: boolean;
  onCambiarFecha: (f: string) => void;
  onCambiarHora: (h: string) => void;
};

// Mismas clases que `fieldClass` de NewAppointmentModal.
const fieldClass =
  "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-surface-low disabled:text-ink-soft";

/**
 * Día (mini-calendario con los días libres en verde) y hora de "Agendar".
 * Los horarios que ya pasaron nunca se ofrecen (regla 1.9, en hora argentina).
 */
export function DiaYHoraDelTurno({
  serviceId,
  providerId,
  fecha,
  hora,
  horaLibre,
  elegirPrimerDiaLibre,
  onCambiarFecha,
  onCambiarHora,
}: Props) {
  const [mes, setMes] = useState((fecha || todayLocal()).slice(0, 7));
  const delMes = useMonthAvailability(serviceId, providerId, mes);
  // En depilación la hora es libre: no hace falta pedir los huecos del día.
  const delDia = useAvailability(horaLibre ? null : serviceId, horaLibre ? null : fecha || null, {
    providerId: providerId ?? undefined,
  });
  // Hora que se descartó por no estar libre (cubre el prefill de la grilla/traspaso
  // y la hora vieja tras cambiar de servicio o prestadora).
  const [descartada, setDescartada] = useState<{ fecha: string; hora: string } | null>(null);
  const yaEligioPrimero = useRef(false);

  const dias = delMes.data?.availableDays;
  useEffect(() => {
    if (!elegirPrimerDiaLibre || fecha || yaEligioPrimero.current || !dias) return;
    const primero = primerDiaLibre(dias, todayLocal());
    if (primero) {
      yaEligioPrimero.current = true;
      onCambiarFecha(primero);
    }
  }, [elegirPrimerDiaLibre, fecha, dias, onCambiarFecha]);

  const libres = (delDia.data?.slots ?? []).filter((s) => !yaPaso(fecha, minutosDe(s.start)));
  const cargoElDia =
    Boolean(fecha) && !horaLibre && !delDia.isFetching && !delDia.isError && delDia.data?.date === fecha;

  useEffect(() => {
    if (!cargoElDia || !hora) return;
    if (libres.some((s) => s.start === hora)) {
      // Eligió una hora libre: lo descartado antes ya no vale (si después
      // cambia de prestadora y deja de estar libre, hay que limpiarla de nuevo).
      if (descartada) setDescartada(null);
      return;
    }
    // Una sola vez por (día, hora): si el padre no la limpia, no se insiste.
    if (descartada?.fecha === fecha && descartada.hora === hora) return;
    setDescartada({ fecha, hora });
    onCambiarHora("");
  }, [cargoElDia, hora, fecha, libres, descartada, onCambiarHora]);

  if (!serviceId || !providerId) {
    return <p className="text-xs text-ink-soft">Elegí servicio y prestadora para ver los días libres</p>;
  }

  const horaPasada = Boolean(fecha) && Boolean(hora) && yaPaso(fecha, minutosDe(hora));

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Día <span className="font-normal text-ink-soft/70">(en verde, los días con horario libre)</span>
        </label>
        <AvailabilityCalendar
          month={mes}
          selected={fecha || null}
          availableDays={new Set(delMes.data?.availableDays ?? [])}
          loading={delMes.isFetching}
          hoy={todayLocal()}
          onSelectDay={(d) => {
            onCambiarFecha(d);
            onCambiarHora("");
          }}
          onMonthChange={setMes}
        />
      </div>

      <div>
        <label htmlFor="agendar-hora" className="mb-1 block text-xs font-medium text-ink-soft">
          Hora inicio
        </label>
        {horaLibre ? (
          <input
            id="agendar-hora"
            type="time"
            aria-label="Hora inicio"
            className={fieldClass}
            value={hora}
            onChange={(e) => onCambiarHora(e.target.value)}
          />
        ) : (
          <select
            id="agendar-hora"
            aria-label="Hora inicio"
            className={fieldClass}
            value={hora}
            disabled={!fecha || delDia.isFetching}
            onChange={(e) => onCambiarHora(e.target.value)}
          >
            <option value="">{fecha ? "Elegí un horario" : "Primero elegí un día"}</option>
            {libres.map((s) => (
              <option key={s.start} value={s.start}>
                {s.start}
              </option>
            ))}
          </select>
        )}
        {!horaLibre && !hora && descartada?.fecha === fecha && (
          <p className="mt-1 text-xs text-red-600">
            El horario {descartada.hora} no está libre con esta prestadora. Elegí otro.
          </p>
        )}
        {!horaLibre && cargoElDia && libres.length === 0 && (
          <p className="mt-1 text-xs text-ink-soft">No quedan horarios libres este día</p>
        )}
        {horaPasada && <p className="mt-1 text-xs text-red-600">{AVISO_HORARIO_PASADO}</p>}
      </div>
    </div>
  );
}
