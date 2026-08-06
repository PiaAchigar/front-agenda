import { Badge, Button, ErrorNote } from "../../components/ui";
import { useClasses } from "../../api/agenda";
import type { ClassOccurrence } from "../../api/types";

/**
 * Agenda de clases y capacitaciones.
 *
 * A diferencia de la grilla de turnos, acá cada fila es UNA CLASE, no una
 * inscripta: la clase de Pilates de las 10 con 6 anotadas es una card, no seis
 * cards apiladas. Y una clase sin nadie anotado igual aparece, porque la
 * profesora la dicta igual.
 *
 * Es una lista cronológica y no una grilla por columnas a propósito: las clases
 * de un día son pocas y lo que importa es el orden y el cupo, no la ubicación
 * espacial en un eje de prestadoras.
 */
export function ClassesView({
  date,
  onOpenAttendance,
  className = "",
}: {
  date: string;
  onOpenAttendance: (occurrence: ClassOccurrence) => void;
  className?: string;
}) {
  const { data: classes, isLoading, error } = useClasses(date);

  if (error) return <ErrorNote message={(error as Error).message} />;

  return (
    <div className={`overflow-auto ${className}`}>
      {isLoading && <p className="p-6 text-sm text-ink-soft">Cargando clases…</p>}

      {!isLoading && classes?.length === 0 && (
        <div className="p-6 text-sm text-ink-soft">
          No hay clases ni capacitaciones este día.
        </div>
      )}

      <ul className="space-y-2 p-2 sm:p-4">
        {classes?.map((occurrence) => (
          <ClassCard
            key={occurrence.occurrenceId}
            occurrence={occurrence}
            onOpenAttendance={onOpenAttendance}
          />
        ))}
      </ul>
    </div>
  );
}

function ClassCard({
  occurrence,
  onOpenAttendance,
}: {
  occurrence: ClassOccurrence;
  onOpenAttendance: (occurrence: ClassOccurrence) => void;
}) {
  const isTraining = occurrence.kind === "training";
  const { capacity, enrolledCount } = occurrence;

  const isFull = capacity !== null && enrolledCount >= capacity;
  const isOverbooked = capacity !== null && enrolledCount > capacity;
  const occupancyPct =
    capacity && capacity > 0 ? Math.min(100, Math.round((enrolledCount / capacity) * 100)) : 0;

  // La asistencia hoy sólo existe para actividades: activity_attendance cuelga
  // de una suscripción a una actividad. Ver planning/agenda_asistencia.md.
  const canMarkAttendance = !isTraining;
  const isPast = new Date(occurrence.startsAt).getTime() <= Date.now();

  return (
    <li className="rounded-xl border border-surface-high bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-ink-soft">
              {occurrence.startTime}–{occurrence.endTime}
            </span>
            <p className="truncate font-semibold text-ink">{occurrence.name}</p>
            <Badge tone={isTraining ? "primary" : "neutral"}>
              {isTraining ? "Capacitación" : "Actividad"}
            </Badge>
            {isTraining && occurrence.sessionNumber && (
              <Badge tone="neutral">
                Encuentro {occurrence.sessionNumber}
                {occurrence.totalSessions ? ` de ${occurrence.totalSessions}` : ""}
              </Badge>
            )}
          </div>

          <p className="mt-1 truncate text-sm text-ink-soft">
            {[
              occurrence.providerName ?? "Sin prestadora asignada",
              occurrence.machineName,
              occurrence.location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {occurrence.attendedCount > 0 && (
            <Badge tone="success">{occurrence.attendedCount} asistieron</Badge>
          )}
          <Badge tone={isOverbooked ? "danger" : isFull ? "warning" : "neutral"}>
            {capacity === null
              ? `${enrolledCount} inscriptas`
              : `${enrolledCount}/${capacity} inscriptas`}
          </Badge>
          {canMarkAttendance && (
            <Button
              variant="secondary"
              onClick={() => onOpenAttendance(occurrence)}
              // Registrar una clase que todavía no ocurrió lo rechaza el backend.
              disabled={!isPast}
              title={!isPast ? "La clase todavía no ocurrió" : undefined}
            >
              Asistencias
            </Button>
          )}
        </div>
      </div>

      {capacity !== null && (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-high"
          role="progressbar"
          aria-valuenow={occupancyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Cupo: ${enrolledCount} de ${capacity}`}
        >
          <div
            className={`h-full rounded-full transition-all ${
              isOverbooked ? "bg-red-500" : isFull ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
      )}

      {isOverbooked && (
        <p className="mt-2 text-xs text-red-700">
          Hay más inscriptas que el cupo declarado ({enrolledCount} sobre {capacity}).
        </p>
      )}
    </li>
  );
}
