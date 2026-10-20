import { useEffect, useState } from "react";
import { useAvailability, useMonthAvailability } from "../../api/agenda";
import { todayLocal } from "../../lib/format";
import { mesSiguiente } from "../../lib/grillaDelMes";
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
  /** Desde "A agendar": si no hay día, arranca en el primer día libre (buscándolo hasta `MESES_A_BUSCAR` meses adelante). */
  elegirPrimerDiaLibre: boolean;
  onCambiarFecha: (f: string) => void;
  onCambiarHora: (h: string) => void;
};

/** Hasta cuántos meses (contando el que se ve) se busca el primer día libre. */
const MESES_A_BUSCAR = 6;

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
  const mesInicial = (fecha || todayLocal()).slice(0, 7);
  const [mes, setMes] = useState(mesInicial);
  const delMes = useMonthAvailability(serviceId, providerId, mes);
  // En depilación la hora es libre: no hace falta pedir los huecos del día.
  const delDia = useAvailability(horaLibre ? null : serviceId, horaLibre ? null : fecha || null, {
    providerId: providerId ?? undefined,
  });
  // Hora que se descartó por no estar libre (cubre el prefill de la grilla/traspaso
  // y la hora vieja tras cambiar de servicio o prestadora).
  const [descartada, setDescartada] = useState<{ fecha: string; hora: string } | null>(null);
  // Búsqueda del primer día libre ("A agendar"): cuántos meses se miraron y
  // cómo terminó. Es de un servicio con una prestadora: si cambian y no se
  // había encontrado lugar, se vuelve a buscar desde el mes de arranque.
  const clave = `${serviceId}|${providerId}`;
  const [busqueda, setBusqueda] = useState({ de: clave, meses: 1, terminada: false, sinLugar: false });
  if (busqueda.de !== clave) {
    const encontrada = busqueda.terminada && !busqueda.sinLugar;
    setBusqueda(encontrada ? { ...busqueda, de: clave } : { de: clave, meses: 1, terminada: false, sinLugar: false });
    if (!encontrada) setMes(mesInicial);
  }

  // Sólo los días del mes que se está mirando (no los de un pedido anterior).
  const dias = delMes.data?.month === mes ? delMes.data.availableDays : undefined;
  useEffect(() => {
    if (!elegirPrimerDiaLibre || fecha || busqueda.terminada || !dias) return;
    const primero = primerDiaLibre(dias, todayLocal());
    if (primero) {
      // Responde a lo que llegó de la API (los días del mes): no se puede derivar en el render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBusqueda((b) => ({ ...b, terminada: true }));
      onCambiarFecha(primero);
    } else if (busqueda.meses < MESES_A_BUSCAR) {
      setBusqueda((b) => ({ ...b, meses: b.meses + 1 }));
      setMes(mesSiguiente(mes));
    } else {
      setBusqueda((b) => ({ ...b, terminada: true, sinLugar: true }));
    }
  }, [elegirPrimerDiaLibre, fecha, dias, mes, busqueda.terminada, busqueda.meses, onCambiarFecha]);

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
          onMonthChange={(m) => {
            // Cambiar de mes a mano corta la búsqueda: el calendario no se mueve solo.
            setBusqueda((b) => ({ ...b, terminada: true }));
            setMes(m);
          }}
        />
        {busqueda.sinLugar && !fecha && (
          <p className="mt-1 text-xs text-ink-soft">
            No hay días libres en los próximos {MESES_A_BUSCAR} meses para este servicio con esta prestadora.
          </p>
        )}
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
