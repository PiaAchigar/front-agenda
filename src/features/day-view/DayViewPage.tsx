import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAppointments,
  useCompanyConfig,
  useProviderSchedule,
  useProviders,
  useUpdateAppointment,
} from "../../api/agenda";
import type { Appointment } from "../../api/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, ErrorNote, Modal } from "../../components/ui";
import { addDays, formatDate, formatTime, todayLocal } from "../../lib/format";
import { CalendarGrid, type ColumnMode } from "./CalendarGrid";
import { NewAppointmentModal, type NewApptPrefill } from "./NewAppointmentModal";
import { ReschedulingModal } from "./ReschedulingModal";
import { ViewTabs, saveView } from "../../components/ViewTabs";

const STATUS_LABELS: Record<
  string,
  { label: string; tone: "primary" | "success" | "danger" | "warning" }
> = {
  reserved:  { label: "Reserva",    tone: "warning"  },
  scheduled: { label: "Agendado",   tone: "primary"  },
  completed: { label: "Completado", tone: "success"  },
  cancelled: { label: "Cancelado",  tone: "danger"   },
  no_show:   { label: "Ausente",    tone: "warning"  },
};

export function DayViewPage() {
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") ?? todayLocal);
  const [selected, setSelected]             = useState<Appointment | null>(null);
  const [newApptOpen, setNewApptOpen]       = useState(false);
  const [newApptPrefill, setNewApptPrefill] = useState<NewApptPrefill | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [expiredAppt,    setExpiredAppt]    = useState<Appointment | null>(null);
  const [columnMode, setColumnMode] = useState<ColumnMode>(() => {
    return (localStorage.getItem("agenda-column-mode") as ColumnMode) ?? "provider";
  });

  function changeColumnMode(mode: ColumnMode) {
    setColumnMode(mode);
    localStorage.setItem("agenda-column-mode", mode);
  }

  function openReschedule(appt: Appointment) {
    setSelected(null);
    setRescheduleAppt(appt);
    setRescheduleOpen(true);
  }

  // Guardar que estamos en vista "dia" cada vez que se monta esta página
  useEffect(() => { saveView("dia"); }, []);

  function openNewAppt(prefill: NewApptPrefill | null = null) {
    setNewApptPrefill(prefill);
    setNewApptOpen(true);
  }

  const { data: appointments = [], isLoading, error } = useAppointments(date);

  // Detecta reservas que expiraron mientras la página está abierta
  useEffect(() => {
    const check = () => {
      if (expiredAppt) return; // ya hay una mostrándose
      const found = appointments.find(
        (a) =>
          a.status === "reserved" &&
          a.reservationExpiresAt &&
          new Date(a.reservationExpiresAt) <= new Date(),
      );
      if (found) setExpiredAppt(found);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [appointments, expiredAppt]);
  const { data: providersRaw = [] }                   = useProviders();
  const { data: config }                              = useCompanyConfig();
  const { data: providerSchedule }                    = useProviderSchedule(date);
  const update                                        = useUpdateAppointment();

  const providers = useMemo(
    () => providersRaw.map((p) => ({ id: p.id, name: p.fullName ?? "Sin nombre" })),
    [providersRaw],
  );

  const openHours = config?.openHours ?? [];

  function navigate(n: -1 | 1) {
    setDate((d) => addDays(d, n));
  }

  function changeStatus(status: string) {
    if (!selected) return;
    update.mutate({ id: selected.id, status }, { onSettled: () => setSelected(null) });
  }

  const statusInfo = STATUS_LABELS[selected?.status ?? "scheduled"] ?? STATUS_LABELS.scheduled!;

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 100px)" }}>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="group p-1.5 rounded hover:bg-surface-low transition-colors"
            aria-label="Día anterior"
          >
            <ChevronLeft size={18} className="text-ink-soft group-hover:text-primary transition-colors" />
          </button>
         
             {/* Selector de fecha */}
          <label className="flex items-center gap-1.5 rounded-lg border border-surface-highest bg-white px-3 py-1.5 text-sm transition-colors">
            <span className="text-ink-soft text-xs">📅</span>
            <span className="text-ink">{formatDate(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="sr-only"
            />
          <span className="text-xl font-semibold min-w-36 text-center">
          {["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][
            new Date(`${date}T12:00:00Z`).getUTCDay()
          ]}
        </span>
          </label>
          <button
            onClick={() => navigate(1)}
            className="group p-1.5 rounded hover:bg-surface-low transition-colors"
            aria-label="Día siguiente"
          >
            <ChevronRight size={18} className="text-ink-soft group-hover:text-primary transition-colors" />
          </button>
        </div>
     
        <div className="flex items-center gap-2">
          <div className="h-5 w-5">
            <div className={`h-5 w-5 rounded-full border-2 border-primary-container border-t-primary ${isLoading ? "animate-spin" : "invisible"}`} />
          </div>

          {/* Selector de vista Día / Semana / Mes */}
          <ViewTabs current="dia" />

          {/* Toggle prestadora / servicio */}
          <div className="flex rounded-lg border border-surface-highest overflow-hidden text-sm">
            {(["provider", "service"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => changeColumnMode(mode)}
                className={[
                  "px-3 py-1.5 transition-colors",
                  columnMode === mode
                    ? "bg-primary text-white font-medium"
                    : "bg-white text-ink-soft hover:bg-surface-low",
                ].join(" ")}
              >
                {mode === "provider" ? "Por prestadora" : "Por servicio"}
              </button>
            ))}
          </div>

     

          <button
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            onClick={() => openNewAppt()}
          >
            + Nuevo turno
          </button>
        </div>
      </div>

      {error && <ErrorNote message={(error as Error).message} />}

      {/* ── Grid horario ── */}
      <CalendarGrid
        className="flex-1 min-h-0"
        appointments={appointments}
        providers={providers}
        date={date}
        openHours={openHours}
        columnMode={columnMode}
        providerSchedule={providerSchedule}
        onAppointmentClick={setSelected}
        onSlotClick={(columnId, minutes) =>
          columnMode === "provider"
            ? openNewAppt({ providerId: columnId, minutes })
            : openNewAppt({ serviceId: columnId, minutes })
        }
      />

      {/* ── Modal nuevo turno ── */}
      <NewAppointmentModal
        open={newApptOpen}
        date={date}
        prefill={newApptPrefill}
        onClose={() => setNewApptOpen(false)}
      />

      {/* ── Modal de detalle / cambio de estado ── */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.customerName ?? "Turno"}
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              {selected.serviceName}
              {" · "}
              {formatTime(selected.appointmentStart)}–{formatTime(selected.appointmentEnd)}
              {" con "}
              {selected.providerName}
            </p>
            <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>

            {update.error && (
              <ErrorNote message={(update.error as Error).message} />
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {selected.status !== "completed" && (
                <Button onClick={() => changeStatus("completed")} disabled={update.isPending}>
                  Completar
                </Button>
              )}
              {selected.status !== "no_show" && (
                <Button
                  variant="secondary"
                  onClick={() => changeStatus("no_show")}
                  disabled={update.isPending}
                >
                  Ausente
                </Button>
              )}
              {selected.status !== "cancelled" && (
                <Button
                  variant="danger"
                  onClick={() => changeStatus("cancelled")}
                  disabled={update.isPending}
                >
                  Cancelar turno
                </Button>
              )}
              {selected.status !== "scheduled" && selected.status !== "reserved" && (
                <Button
                  variant="secondary"
                  onClick={() => changeStatus("scheduled")}
                  disabled={update.isPending}
                >
                  Restaurar
                </Button>
              )}
              {selected.status === "reserved" && (
                <Button
                  onClick={() => changeStatus("scheduled")}
                  disabled={update.isPending}
                >
                  Confirmar reserva
                </Button>
              )}
              {selected.status !== "completed" && (
                <Button
                  variant="secondary"
                  onClick={() => openReschedule(selected)}
                  disabled={update.isPending}
                >
                  Reagendar
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal de reagendado ── */}
      <ReschedulingModal
        open={rescheduleOpen}
        appointment={rescheduleAppt}
        onClose={() => setRescheduleOpen(false)}
      />

      {/* ── Modal de reserva expirada ── */}
      <Modal
        open={Boolean(expiredAppt)}
        onClose={() => setExpiredAppt(null)}
        title="⏳ Reserva expirada"
      >
        {expiredAppt && (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              La reserva de{" "}
              <span className="font-semibold">{expiredAppt.customerName ?? "Cliente"}</span>{" "}
              para{" "}
              <span className="font-semibold">{expiredAppt.serviceName}</span>{" "}
              ({formatTime(expiredAppt.appointmentStart)} con {expiredAppt.providerName}) expiró y{" "}
              será cancelada automáticamente.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                onClick={() => {
                  openReschedule(expiredAppt);
                  setExpiredAppt(null);
                }}
              >
                Reagendar
              </Button>
              <Button variant="ghost" onClick={() => setExpiredAppt(null)}>
                Enterado
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
