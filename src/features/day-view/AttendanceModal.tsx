import { useEffect, useState } from "react";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { useClassRoster, useMarkAttendance } from "../../api/agenda";

/**
 * Identifica la clase cuyas asistencias se están registrando. Deliberadamente
 * NO es un Appointment: la clase se identifica por (actividad, horario), y
 * tanto la card de un turno como la card de una clase pueden abrirla.
 */
export type AttendanceTarget = {
  activityId: string;
  activityName: string | null;
  /** Instante UTC de inicio de la clase (ISO) */
  startsAt: string;
};

/**
 * Registro de asistencias de una clase.
 *
 * Se abre desde la card de un turno de ACTIVIDAD. Como `appointments.customer_id`
 * es uno solo, una actividad grupal son varios turnos en el mismo horario: el
 * modal los junta a todos por (actividad, horario) y deja tildar cliente por
 * cliente. Lo tildado se guarda en activity_attendance.attended, que es lo que
 * cuenta la columna "Asistió" del panel de Suscripciones.
 */
export function AttendanceModal({
  target,
  onClose,
}: {
  target: AttendanceTarget | null;
  onClose: () => void;
}) {
  const activityId = target?.activityId ?? null;
  const startsAt = target?.startsAt ?? null;

  const roster = useClassRoster(activityId, startsAt);
  const markAttendance = useMarkAttendance();

  // Estado local de los tildes: arranca del roster del servidor y se sincroniza
  // cada vez que llega uno nuevo (abrir el modal, o guardar y refetchear).
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!roster.data) return;
    setChecked(
      Object.fromEntries(
        roster.data
          .filter((r) => r.subscriptionId)
          .map((r) => [r.subscriptionId!, r.attended]),
      ),
    );
  }, [roster.data]);

  // El backend rechaza registrar una clase que todavía no ocurrió; se
  // deshabilita acá también para no ofrecer una acción que va a fallar.
  const isFuture = startsAt ? new Date(startsAt).getTime() > Date.now() : false;

  const markable = (roster.data ?? []).filter((r) => r.canMark);

  const handleSave = async () => {
    if (!activityId || !startsAt) return;
    await markAttendance.mutateAsync({
      activityId,
      startsAt,
      entries: markable.map((r) => ({
        subscriptionId: r.subscriptionId!,
        attended: checked[r.subscriptionId!] ?? false,
      })),
    });
    onClose();
  };

  const title = target?.activityName
    ? `Asistencias · ${target.activityName}`
    : "Asistencias";

  return (
    <Modal open={Boolean(target)} onClose={onClose} title={title}>
      <div className="space-y-4">
        {roster.isLoading && <p className="text-sm text-ink-soft">Cargando clientes...</p>}

        {roster.error && <ErrorNote message={(roster.error as Error).message} />}
        {markAttendance.error && (
          <ErrorNote message={(markAttendance.error as Error).message} />
        )}

        {isFuture && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Esta clase todavía no ocurrió. Vas a poder registrar la asistencia
            una vez que haya pasado.
          </p>
        )}

        {roster.data && roster.data.length === 0 && (
          <p className="text-sm text-ink-soft">No hay clientes agendados a esta clase.</p>
        )}

        {roster.data && roster.data.length > 0 && (
          <ul className="divide-y divide-surface-high rounded-xl border border-surface-high">
            {roster.data.map((entry) => (
              <li
                key={entry.appointmentId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{entry.customerName}</p>
                  {entry.reason && (
                    <p className="text-xs text-amber-700">{entry.reason}</p>
                  )}
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    disabled={!entry.canMark || isFuture || markAttendance.isPending}
                    checked={
                      entry.subscriptionId ? (checked[entry.subscriptionId] ?? false) : false
                    }
                    onChange={(e) =>
                      entry.subscriptionId &&
                      setChecked((prev) => ({
                        ...prev,
                        [entry.subscriptionId!]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-primary disabled:opacity-40"
                  />
                  Asistió
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={isFuture || markable.length === 0 || markAttendance.isPending}
          >
            {markAttendance.isPending ? "Guardando..." : "Guardar asistencias"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={markAttendance.isPending}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
