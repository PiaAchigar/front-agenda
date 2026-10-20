import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAppointments,
  useCompanyConfig,
  useProviderSchedule,
  useProviders,
  useUpdateAppointment,
} from "../../api/agenda";
import type { Appointment, ClassOccurrence, Consumo } from "../../api/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, ErrorNote, Modal } from "../../components/ui";
import { addDays, formatDate, formatTime, todayLocal } from "../../lib/format";
import { CalendarGrid } from "./CalendarGrid";
import { BarraAgenda } from "../barra/BarraAgenda";
import { BuscadorAgenda } from "../barra/BuscadorAgenda";
import { useBusquedaAgenda, usePrestadorasDeLaBusqueda } from "../../lib/busqueda-agenda";
import { FiltrosAgenda } from "../barra/FiltrosAgenda";
import { useModoAgenda } from "../../lib/modo-agenda";
import type { NewApptPrefill } from "./NewAppointmentModal";
import { NuevoTurnoModal } from "../nuevo-turno/NuevoTurnoModal";
import { ReagendarTurnoModal } from "./ReagendarTurnoModal";
import { AvisoInsumosModal } from "./AvisoInsumosModal";
import { hayQueAvisar } from "../../lib/aviso-insumos";
import {
  cancelarPuedeDevolverSenia,
  sePuedeCambiarEstado,
  sePuedeCobrar,
} from "../../lib/acciones-del-turno";
import { AttendanceModal, type AttendanceTarget } from "./AttendanceModal";
import { CobrarLoQueFalta } from "../vender/CobrarLoQueFalta";
import { pesos } from "../../lib/vender";
import { debeDelTurno } from "../../lib/deuda-del-turno";
import { ClassesView } from "./ClassesView";

import { saveView } from "../../components/ViewTabs";
import { isEmbedded, prefillDesdeUrl, requestCheckoutHandoff } from "../../lib/embed";

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
  /**
   * El día vive en la URL, no sólo en el estado.
   *
   * Es lo que hace que recargar devuelva el día que estabas mirando: la ruta
   * que se anota es path + query, así que si el día no está en la query, no se
   * recuerda (ver `lib/ruta-recordada.ts`). De paso, un día concreto pasa a
   * tener su propia dirección.
   *
   * `replace` y no push: mover un día no es navegar, y con push el botón Atrás
   * quedaba recorriendo días de a uno.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date") ?? todayLocal();
  const setDate = useCallback(
    (siguiente: string | ((actual: string) => string)) => {
      setSearchParams(
        (params) => {
          const actual = params.get("date") ?? todayLocal();
          params.set("date", typeof siguiente === "function" ? siguiente(actual) : siguiente);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  // Se guarda el id y no el turno: así el detalle lee siempre la copia fresca
  // (si no, "Debe $X" quedaría viejo después de cobrar).
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [avisoInsumos, setAvisoInsumos]     = useState<Consumo | null>(null);
  const [attendanceFor, setAttendanceFor]   = useState<AttendanceTarget | null>(null);
  // Clase en la que se quiere anotar; por ahora sólo se recuerda (sin modal todavía).
  const [, setAnotarEn] = useState<ClassOccurrence | null>(null);
  // El prefill de "A agendar" que pide la ficha del CRM viaja CRM → dashboard
  // → la URL de este iframe (`lib/embed.ts`, `prefillDesdeUrl`). Se lee acá,
  // en el estado inicial y no en un efecto: así el modal ya nace abierto en
  // el primer render, sin un segundo render disparado por un `setState`
  // dentro de un efecto.
  const [newApptOpen, setNewApptOpen]       = useState(() => prefillDesdeUrl() !== null);
  const [newApptPrefill, setNewApptPrefill] = useState<NewApptPrefill | null>(() => prefillDesdeUrl());
  // Un contador de aperturas para que cada una monte el Nuevo turno de cero
  // (el reset de sus campos lo da el montaje, ver NuevoTurnoModal).
  const [aperturaNuevo, setAperturaNuevo] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [expiredAppt,    setExpiredAppt]    = useState<Appointment | null>(null);
  // Turnos individuales vs grupales (clases): ver `lib/modo-agenda.ts`.
  const [agendaMode] = useModoAgenda();
  const columnIds = usePrestadorasDeLaBusqueda();
  const { busqueda } = useBusquedaAgenda();

  function openReschedule(appt: Appointment) {
    setSelectedId(null);
    setRescheduleAppt(appt);
    setRescheduleOpen(true);
  }

  // Guardar que estamos en vista "dia" cada vez que se monta esta página
  useEffect(() => { saveView("dia"); }, []);

  function openNewAppt(prefill: NewApptPrefill | null = null) {
    setNewApptPrefill(prefill);
    setAperturaNuevo((n) => n + 1);
    setNewApptOpen(true);
  }

  // Sacar el prefill de la URL apenas se usó para abrir el modal de arriba:
  // si quedara, un refresh (o cerrar este modal y volver a entrar a "/dia")
  // lo reabriría solo, sin que Laura lo haya vuelto a pedir. No hace falta
  // proteger un turno normal de esto: tocar un slot llama
  // a `openNewAppt` con su propio prefill y siempre reemplazan el estado.
  useEffect(() => {
    if (!newApptPrefill) return;
    setSearchParams(
      (params) => {
        params.delete("customerId");
        params.delete("serviceId");
        params.delete("purchaseServiceId");
        return params;
      },
      { replace: true },
    );
    // Sólo al montar: es la limpieza única del prefill inicial que leyó el
    // `useState`, no algo que deba repetirse en cada cambio de `newApptPrefill`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: allAppointments = [], isLoading, error } = useAppointments(date);

  // La grilla de turnos muestra sólo los turnos 1 a 1. Las inscripciones a
  // clases y capacitaciones viven en la vista "Clases": si se dibujaran acá,
  // 6 inscriptas al mismo Pilates serían 6 cards superpuestas en el mismo slot.
  const appointments = allAppointments.filter(
    (appt) => !appt.activityId && !appt.trainingSessionId,
  );

  // `?turno=<id>` (viene de la semana): una vez cargado el día, abre el detalle
  // de ese turno y borra el param para que no se reabra al cerrar.
  const turnoPedido = searchParams.get("turno");
  useEffect(() => {
    if (!turnoPedido || isLoading) return;
    const pedido = allAppointments.find((a) => a.id === turnoPedido);
    if (pedido) setSelectedId(pedido.id);
    setSearchParams(
      (params) => {
        params.delete("turno");
        return params;
      },
      { replace: true },
    );
  }, [turnoPedido, isLoading, allAppointments, setSearchParams]);

  // IDs de reservas expiradas ya notificadas — evita re-disparar el modal
  // tras "Enterado" mientras el cron aún no canceló el turno.
  const shownExpiredIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = () => {
      // Sobre allAppointments, no sobre la grilla filtrada: una reserva a una
      // clase también expira y hay que avisar igual, se esté viendo la vista
      // de turnos o la de clases.
      const found = allAppointments.find(
        (a) =>
          a.status === "reserved" &&
          a.reservationExpiresAt &&
          new Date(a.reservationExpiresAt) <= new Date() &&
          !shownExpiredIds.current.has(a.id),
      );
      if (found) setExpiredAppt(found);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [allAppointments]); // expiredAppt NO va aquí — evita loop
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
    update.mutate(
      { id: selected.id, status },
      {
        // Al completar, el backend descuenta los insumos de la receta y
        // devuelve `consumo`. Sólo se interrumpe si algo quedó en negativo.
        onSuccess: (r) => {
          if (hayQueAvisar(r.consumo)) setAvisoInsumos(r.consumo!);
        },
        onSettled: () => setSelectedId(null),
      },
    );
  }

  const selected = selectedId ? (allAppointments.find((a) => a.id === selectedId) ?? null) : null;
  const debe = selected ? debeDelTurno(selected) : null;
  const statusInfo = STATUS_LABELS[selected?.status ?? "scheduled"] ?? STATUS_LABELS.scheduled!;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* ── Barra ── */}
      <BarraAgenda
        vista="dia"
        cargando={isLoading}
        fecha={
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => navigate(-1)}
              className="group p-1 rounded hover:bg-surface-low transition-colors"
              aria-label="Día anterior"
            >
              <ChevronLeft size={18} className="text-ink-soft group-hover:text-primary transition-colors" />
            </button>
         
               {/* Selector de fecha */}
            <label className="flex items-center gap-1 rounded-lg border border-surface-highest bg-white px-3 py-1.5 text-sm transition-colors">
              <span className="text-ink-soft text-xs">📅</span>
              <span className="text-ink">{formatDate(date)}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="sr-only"
              />
                <span className="text-l font-semibold min-w-24 text-center">
                {["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][
                  new Date(`${date}T12:00:00Z`).getUTCDay()
                ]}
              </span> 
            </label>
            <button
              onClick={() => navigate(1)}
              className="group p-1 rounded hover:bg-surface-low transition-colors"
              aria-label="Día siguiente"
            >
              <ChevronRight size={18} className="text-ink-soft group-hover:text-primary transition-colors" />
            </button>
          </div>
        }
        buscador={agendaMode === "turnos" ? <BuscadorAgenda /> : undefined}
      />

      {agendaMode === "turnos" && <FiltrosAgenda />}

      {error && <ErrorNote message={(error as Error).message} />}

      {agendaMode === "turnos" ? (
        /* ── Grid horario: una card por persona ── */
        <CalendarGrid
          className="flex-1 min-h-0"
          appointments={appointments}
          providers={providers}
          date={date}
          openHours={openHours}
          columnIds={columnIds}
          providerSchedule={providerSchedule}
          onAppointmentClick={(a) => setSelectedId(a.id)}
          onSlotClick={(columnId, minutes) =>
            openNewAppt({
              providerId: columnId,
              providerName: providers.find((p) => p.id === columnId)?.name,
              minutes,
              // Con un solo servicio buscado, el hueco ya sabe qué se va a hacer.
              ...(busqueda.servicios.length === 1 ? { serviceId: busqueda.servicios[0]! } : {}),
            })
          }
        />
      ) : (
        /* ── Clases y capacitaciones: una card por clase, con su cupo ── */
        <ClassesView
          className="flex-1 min-h-0"
          date={date}
          onOpenAttendance={(occurrence) =>
            setAttendanceFor({
              activityId: occurrence.subjectId,
              activityName: occurrence.name,
              startsAt: occurrence.startsAt,
              machineId: occurrence.machineId,
            })
          }
          // Las Tasks 4-6 conectan los modales de anotar y cobrar.
          onAnotar={setAnotarEn}
          onCobrar={() => {}}
        />
      )}

      {/* ── Nuevo turno (se monta de cero en cada apertura) ── */}
      {newApptOpen && (
        <NuevoTurnoModal
          key={`nuevo-${aperturaNuevo}`}
          date={date}
          prefill={newApptPrefill}
          onClose={() => setNewApptOpen(false)}
          onCambiarDia={setDate}
        />
      )}

      {/* ── Modal de detalle / cambio de estado ── */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
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

            {/* Un ausente NO es terminal: el backend deja las cuatro
                transiciones. El cartel no está para justificar botones
                escondidos sino para decir qué hace cada uno — sobre todo
                Cancelar, cuya devolución de seña depende de la hora. */}
            {selected.status === "no_show" && (
              <p className="rounded-lg bg-surface-high px-3 py-2 text-sm text-ink-soft">
                Marcado como ausente. Si fue un error, <strong>Restaurar</strong> lo vuelve a
                agendar y <strong>Reagendar</strong> lo mueve a otro horario.{" "}
                {cancelarPuedeDevolverSenia(selected, new Date())
                  ? "Cancelar libera el turno y, si había seña, se la devuelve a la clienta como saldo a favor."
                  : "Cancelar libera el turno, pero la seña ya no se devuelve: pasada la hora, ausente y cancelado pagan igual."}
              </p>
            )}

            {!sePuedeCambiarEstado(selected) && (
              <p className="rounded-lg bg-surface-high px-3 py-2 text-sm text-ink-soft">
                Este turno ya está cerrado: quedó marcado como realizado, así que no se le
                puede cambiar el estado ni reagendar.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {/* Turno de ACTIVIDAD: abre el registro de asistencias de la clase,
                  con todos los clientes agendados a ese mismo horario. */}
              {selected.activityId && (
                <Button
                  onClick={() => {
                    setAttendanceFor({
                      activityId: selected.activityId!,
                      activityName: selected.activityName,
                      startsAt: selected.appointmentStart,
                      machineId: null,
                    });
                    setSelectedId(null);
                  }}
                >
                  Asistencias
                </Button>
              )}
              {sePuedeCobrar(selected, isEmbedded) && (
                <Button
                  onClick={() => requestCheckoutHandoff(selected.id, selected.customerId!)}
                >
                  Cobrar
                </Button>
              )}
              {/* La deuda es de la compra entera: se cobra sobre la compra. El
                  "Cobrar" común sigue bloqueado para estos turnos (sePuedeCobrar). */}
              {selected.customerPurchaseId && debe !== null && (
                <>
                  <p className="self-center text-sm font-medium text-amber-700">Debe {pesos(debe)}</p>
                  <CobrarLoQueFalta
                    compraId={selected.customerPurchaseId}
                    descripcion={selected.serviceName ?? "Compra"}
                    etiqueta={`Cobrar ${pesos(debe)}`}
                    variante="primary"
                  />
                </>
              )}
              {selected.status !== "completed" && (
                <Button
                  variant={selected.status === "no_show" ? "secondary" : "success"}
                  onClick={() => changeStatus("completed")}
                  disabled={update.isPending}
                >
                  Realizado
                </Button>
              )}
              {sePuedeCambiarEstado(selected) && selected.status !== "no_show" && (
                <Button
                  variant="secondary"
                  onClick={() => changeStatus("no_show")}
                  disabled={update.isPending}
                >
                  Ausente
                </Button>
              )}
              {sePuedeCambiarEstado(selected) && selected.status !== "cancelled" && (
                <Button
                  variant="danger"
                  onClick={() => changeStatus("cancelled")}
                  disabled={update.isPending}
                >
                  Cancelar turno
                </Button>
              )}
              {/* Un turno de clase cancelado no se restaura: se vuelve a anotar con "Anotar". */}
              {sePuedeCambiarEstado(selected) &&
                !(selected.status === "cancelled" && (selected.activityId || selected.trainingSessionId)) &&
                selected.status !== "scheduled" &&
                selected.status !== "reserved" && (
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

      {/* ── Modal de asistencias de una clase ── */}
      <AttendanceModal
        target={attendanceFor}
        onClose={() => setAttendanceFor(null)}
      />

      {/* ── Modal de reagendado ── Se monta sólo abierto: así cada apertura
          arranca del turno tal como está (y no de lo que se tocó y se abandonó
          la vez anterior) y sus consultas de disponibilidad no quedan vivas
          con el modal cerrado. */}
      {rescheduleOpen && (
        <ReagendarTurnoModal
          key={rescheduleAppt?.id ?? "none"}
          open
          appointment={rescheduleAppt}
          onClose={() => setRescheduleOpen(false)}
        />
      )}

      {/* Aparece solo si al completar un turno algún insumo quedó en negativo. */}
      <AvisoInsumosModal consumo={avisoInsumos} onClose={() => setAvisoInsumos(null)} />

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
              <Button
                variant="ghost"
                onClick={() => {
                  if (expiredAppt) shownExpiredIds.current.add(expiredAppt.id);
                  setExpiredAppt(null);
                }}
              >
                Enterado
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
