import { useMemo, useState } from "react";
import { useAppointments, useUpdateAppointment } from "../../api/agenda";
import type { Appointment } from "../../api/types";
import { Badge, Button, Card, ErrorNote, Modal, Spinner } from "../../components/ui";

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const STATUS_LABELS: Record<string, { label: string; tone: "primary" | "success" | "danger" | "warning" }> = {
  scheduled: { label: "Agendado", tone: "primary" },
  completed: { label: "Completado", tone: "success" },
  cancelled: { label: "Cancelado", tone: "danger" },
  no_show: { label: "Ausente", tone: "warning" },
};

export function DayViewPage() {
  const [date, setDate] = useState(todayLocal());
  const [selected, setSelected] = useState<Appointment | null>(null);
  const { data: appointments, isLoading, error } = useAppointments(date);
  const update = useUpdateAppointment();

  const byProvider = useMemo(() => {
    const map = new Map<string, { name: string; items: Appointment[] }>();
    for (const appt of appointments ?? []) {
      const key = appt.providerId ?? "unassigned";
      const entry = map.get(key) ?? { name: appt.providerName ?? "Sin asignar", items: [] };
      entry.items.push(appt);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [appointments]);

  const changeStatus = (status: string) => {
    if (!selected) return;
    update.mutate({ id: selected.id, status }, { onSettled: () => setSelected(null) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-semibold">Turnos del día</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorNote message={(error as Error).message} />}

      {!isLoading && byProvider.length === 0 && (
        <Card className="text-center text-ink-soft">No hay turnos para esta fecha.</Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {byProvider.map((column) => (
          <div key={column.name} className="space-y-3">
            <h3 className="text-xl font-semibold text-secondary">{column.name}</h3>
            {column.items.map((appt) => {
              const status = STATUS_LABELS[appt.status ?? "scheduled"] ?? STATUS_LABELS.scheduled;
              return (
                <Card
                  key={appt.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                >
                  <button
                    className="w-full text-left"
                    onClick={() => setSelected(appt)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">
                        {formatTime(appt.appointmentStart)}–{formatTime(appt.appointmentEnd)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm">{appt.customerName ?? "Cliente"}</p>
                    <p className="text-xs text-ink-soft">
                      {appt.serviceName}
                      {appt.machineName ? ` · ${appt.machineName}` : ""}
                    </p>
                  </button>
                </Card>
              );
            })}
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.customerName ?? "Turno"}
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              {selected.serviceName} · {formatTime(selected.appointmentStart)} con{" "}
              {selected.providerName}
            </p>
            {update.error && <ErrorNote message={(update.error as Error).message} />}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => changeStatus("completed")} disabled={update.isPending}>
                Completar
              </Button>
              <Button
                variant="secondary"
                onClick={() => changeStatus("no_show")}
                disabled={update.isPending}
              >
                Ausente
              </Button>
              <Button
                variant="danger"
                onClick={() => changeStatus("cancelled")}
                disabled={update.isPending}
              >
                Cancelar turno
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
