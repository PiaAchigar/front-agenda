import { useEffect, useState } from "react";
import { useRescheduleAppointment } from "../../api/agenda";
import type { Appointment } from "../../api/types";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { formatDate, formatTime } from "../../lib/format";
import { addDays } from "../../lib/format";

function toArgentinaISO(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00-03:00`;
}

function isoToDateAndTime(iso: string): { date: string; time: string } {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));

  const get = (t: string) => local.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

type Props = {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
};

export function ReschedulingModal({ open, appointment, onClose }: Props) {
  const reschedule = useRescheduleAppointment();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!open || !appointment) return;
    const parsed = isoToDateAndTime(appointment.appointmentStart);
    setDate(parsed.date);
    setTime(parsed.time);
    reschedule.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!appointment) return null;

  const fieldClass =
    "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  function handleSubmit() {
    if (!appointment || !date || !time) return;
    reschedule.mutate(
      { id: appointment.id, newStart: toArgentinaISO(date, time) },
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
