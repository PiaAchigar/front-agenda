import { useState } from "react";
import { useRescheduleAppointment, useReschedules } from "../../api/agenda";
import type { Appointment } from "../../api/types";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { addDays, formatDate, formatDateTime, formatTime } from "../../lib/format";
import { isoToDateAndTime, toArgentinaISO } from "../../lib/reagendar";

type Props = {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
};

export function ReschedulingModal({ open, appointment, onClose }: Props) {
  const reschedule = useRescheduleAppointment();
  // El historial se pide sólo con el modal abierto: es la única pantalla que lo
  // muestra y no tiene sentido traerlo por cada turno del día.
  const historial = useReschedules(open && appointment ? appointment.id : null);

  // Estado inicializado directo desde el appointment.
  // El componente se remonta con `key={appointment.id}` en el padre,
  // así que no hace falta un useEffect para resetear.
  const initial  = appointment ? isoToDateAndTime(appointment.appointmentStart) : null;
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [reason, setReason] = useState("");

  if (!appointment) return null;

  const fieldClass =
    "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  function handleSubmit() {
    if (!appointment || !date || !time) return;
    reschedule.mutate(
      { id: appointment.id, newStart: toArgentinaISO(date, time), reason: reason.trim() || undefined },
      { onSuccess: onClose },
    );
  }

  const DAY_LABELS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const dow = date ? new Date(`${date}T12:00:00Z`).getUTCDay() : null;

  return (
    <Modal open={open} onClose={onClose} title="Reagendar turno">
      <div className="space-y-4">
        {/* Info del turno original */}
        <div className="rounded-xl border border-surface-high bg-surface-low px-3 py-2.5 text-sm">
          <p className="font-medium text-ink">{appointment.customerName ?? "Cliente"}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            {appointment.serviceName} · {formatTime(appointment.appointmentStart)} con {appointment.providerName}
          </p>
        </div>

        {/* Nueva fecha */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Nueva fecha</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate((d) => addDays(d, -1))}
              className="group p-1.5 rounded hover:bg-surface-low transition-colors"
            >
              <span className="text-ink-soft group-hover:text-primary">‹</span>
            </button>
            <div className="relative flex-1">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              onClick={() => setDate((d) => addDays(d, 1))}
              className="group p-1.5 rounded hover:bg-surface-low transition-colors"
            >
              <span className="text-ink-soft group-hover:text-primary">›</span>
            </button>
          </div>
          {dow !== null && (
            <p className="mt-1 text-xs text-ink-soft">
              {DAY_LABELS[dow]} {formatDate(date)}
            </p>
          )}
        </div>

        {/* Nueva hora */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Nueva hora de inicio</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-ink-soft">
            La hora de fin se recalcula según la duración del servicio.
          </p>
        </div>

        {/* Motivo */}
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
            disabled={!date || !time || reschedule.isPending}
          >
            {reschedule.isPending ? "Guardando…" : "Confirmar reagendado"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
