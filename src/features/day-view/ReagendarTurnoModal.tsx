import { useState } from "react";
import {
  useAvailability,
  useMonthAvailability,
  useProvidersByService,
  useRescheduleAppointment,
  useReschedules,
} from "../../api/agenda";
import type { Appointment } from "../../api/types";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { formatDateTime, todayLocal } from "../../lib/format";
import { isoToDateAndTime, toArgentinaISO } from "../../lib/reagendar";
import { AvailabilityCalendar } from "./AvailabilityCalendar";

type Props = {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
};

// Mismas clases que `fieldClass` de NewAppointmentModal: es la misma vista.
const fieldClass =
  "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-surface-low disabled:text-ink-soft";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * "Reagendar": la vista de "Nuevo turno" para mover un turno que ya existe.
 *
 * El servicio y la clienta no se tocan; la prestadora sí (entre las que ofrecen
 * ese servicio) y el día se elige en un calendario que pinta de verde los días
 * en que esa prestadora tiene hueco. Se monta con `key={appointment.id}` en el
 * padre, así el estado inicial sale directo del turno y no hace falta un efecto
 * que lo resetee. Se monta SIEMPRE (se apaga por `open`), por eso todos los
 * hooks corren con `null` cuando todavía no hay turno.
 */
export function ReagendarTurnoModal({ open, appointment, onClose }: Props) {
  const reschedule = useRescheduleAppointment();
  // El historial se pide sólo con el modal abierto: es la única pantalla que lo
  // muestra y no tiene sentido traerlo por cada turno del día.
  const historial = useReschedules(open && appointment ? appointment.id : null);

  const initial = appointment ? isoToDateAndTime(appointment.appointmentStart) : null;
  const [providerId, setProviderId] = useState(appointment?.providerId ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [month, setMonth] = useState((initial?.date ?? todayLocal()).slice(0, 7));
  const [reason, setReason] = useState("");

  const serviceId = appointment?.serviceId ?? null;
  const proveedoras = useProvidersByService(serviceId);
  const mes = useMonthAvailability(serviceId, providerId || null, month, appointment?.id);
  const dia = useAvailability(serviceId, date || null, {
    providerId: providerId || undefined,
    excludeAppointmentId: appointment?.id,
  });

  if (!appointment) return null;

  const providers = proveedoras.data ?? [];
  const slots = dia.data?.slots ?? [];
  // Si la hora elegida ya no está entre los huecos libres (cambió el día o la
  // prestadora), no vale: el select vuelve a "Elegí un horario".
  const slotElegido = slots.find((s) => s.start === time) ?? null;
  const timeValida = slotElegido ? time : "";
  const availableDays = new Set(mes.data?.availableDays ?? []);

  function cambiarProveedora(id: string) {
    setProviderId(id);
    setDate("");
    setTime("");
  }

  function handleSubmit() {
    if (!appointment || !date || !timeValida || !providerId) return;
    reschedule.mutate(
      {
        id: appointment.id,
        newStart: toArgentinaISO(date, timeValida),
        providerId: providerId !== appointment.providerId ? providerId : undefined,
        reason: reason.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  }

  const dow = date ? new Date(`${date}T12:00:00Z`).getUTCDay() : null;
  const dateLabel =
    dow !== null ? `${DAY_LABELS[dow]} ${date.split("-").reverse().join("/")}` : "Elegí un día";

  return (
    <Modal open={open} onClose={onClose} title="Reagenda el turno">
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2">
          <span className="text-base">📅</span>
          <span className="text-sm font-medium text-primary">
            Hoy: {formatDateTime(appointment.appointmentStart)} con {appointment.providerName}
          </span>
        </div>

        <div>
          <label htmlFor="rg-cliente" className="mb-1 block text-xs font-medium text-ink-soft">
            Cliente
          </label>
          <input
            id="rg-cliente"
            className={fieldClass}
            value={appointment.customerName ?? "Cliente"}
            disabled
            readOnly
          />
        </div>

        <div>
          <label htmlFor="rg-servicio" className="mb-1 block text-xs font-medium text-ink-soft">
            Servicio
          </label>
          <input
            id="rg-servicio"
            className={fieldClass}
            value={appointment.serviceName ?? ""}
            disabled
            readOnly
          />
        </div>

        <div>
          <label htmlFor="rg-prestadora" className="mb-1 block text-xs font-medium text-ink-soft">
            Prestadora
          </label>
          <select
            id="rg-prestadora"
            className={fieldClass}
            value={providerId}
            onChange={(e) => cambiarProveedora(e.target.value)}
          >
            {/* La actual aparece siempre, aunque la lista todavía no haya llegado. */}
            {!providers.some((p) => p.id === providerId) && providerId && (
              <option value={providerId}>{appointment.providerName}</option>
            )}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Nueva fecha <span className="font-normal text-ink-soft/70">(en verde, los días con horario libre)</span>
          </label>
          <AvailabilityCalendar
            month={month}
            selected={date || null}
            availableDays={availableDays}
            loading={mes.isFetching}
            hoy={todayLocal()}
            onSelectDay={(d) => {
              setDate(d);
              setTime("");
            }}
            onMonthChange={setMonth}
          />
          <p className="mt-1 text-xs text-ink-soft">{dateLabel}</p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="rg-hora" className="mb-1 block text-xs font-medium text-ink-soft">
              Hora inicio
            </label>
            <select
              id="rg-hora"
              className={fieldClass}
              value={timeValida}
              disabled={!date || dia.isFetching}
              onChange={(e) => setTime(e.target.value)}
            >
              <option value="">
                {!date
                  ? "Primero elegí un día"
                  : dia.isFetching
                    ? "Buscando horarios…"
                    : slots.length === 0
                      ? "Sin horarios libres ese día"
                      : "Elegí un horario"}
              </option>
              {slots.map((s) => (
                <option key={s.start} value={s.start}>
                  {s.start}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="rg-fin" className="mb-1 block text-xs font-medium text-ink-soft">
              Hora fin <span className="font-normal text-ink-soft/70">(según servicio)</span>
            </label>
            <input
              id="rg-fin"
              type="time"
              className={fieldClass}
              value={slotElegido?.end ?? ""}
              disabled
              readOnly
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Motivo <span className="font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Ej: la clienta no podía a esa hora"
            className={fieldClass}
          />
        </div>

        {/* Historial. Se muestra acá, y no en otra pantalla, porque el momento
            de decidir es justo antes de volver a mover el turno. */}
        {historial.data && historial.data.length > 0 && (
          <div className="rounded-xl border border-surface-high bg-surface-low px-3 py-2.5">
            <p className="text-xs font-medium text-ink-soft">
              Este turno ya se movió {historial.data.length}{" "}
              {historial.data.length === 1 ? "vez" : "veces"}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {historial.data.map((m) => (
                <li key={m.id} className="text-xs text-ink-soft">
                  <span className="text-ink">
                    {m.previousStart ? formatDateTime(m.previousStart) : "—"} →{" "}
                    {formatDateTime(m.newStart)}
                  </span>
                  {m.previousProviderName &&
                    m.newProviderName &&
                    m.previousProviderName !== m.newProviderName && (
                      <span>
                        {" "}
                        · {m.previousProviderName} → {m.newProviderName}
                      </span>
                    )}
                  {m.reason && <span> · {m.reason}</span>}
                  <span className="block text-[11px] opacity-70">
                    {formatDateTime(m.createdAt)}
                    {m.rescheduledByName ? ` · ${m.rescheduledByName}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {reschedule.error && <ErrorNote message={(reschedule.error as Error).message} />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={reschedule.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!date || !timeValida || !providerId || reschedule.isPending}
          >
            {reschedule.isPending ? "Guardando…" : "Confirmar reagendado"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
