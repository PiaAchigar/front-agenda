import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Appointment,
  Availability,
  Category,
  ClassOccurrence,
  ClassRosterEntry,
  CompanyConfig,
  Consumo,
  Customer,
  DatosParaAgendar,
  Provider,
  ProviderService,
  Reschedule,
  Service,
  Sexo,
} from "./types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/api/agenda/categories"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useServices(categoryId?: string) {
  const qs = categoryId ? `?categoryId=${categoryId}` : "";
  return useQuery({
    queryKey: ["services", categoryId ?? "all"],
    queryFn: () => api<Service[]>(`/api/agenda/services${qs}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAvailability(serviceId: string | null, date: string | null) {
  return useQuery({
    queryKey: ["availability", serviceId, date],
    queryFn: () => api<Availability>(`/api/agenda/availability/${serviceId}?date=${date}`),
    enabled: Boolean(serviceId && date),
  });
}

export type ProviderWindow = { start: number; end: number };
export type ProviderSchedule = { providerId: string; windows: ProviderWindow[] };

export function useProviderSchedule(date: string) {
  return useQuery({
    queryKey: ["provider-schedule", date],
    queryFn: () => api<ProviderSchedule[]>(`/api/agenda/providers/schedule?date=${date}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAppointments(date: string) {
  return useQuery({
    queryKey: ["appointments", date],
    queryFn: () => api<Appointment[]>(`/api/agenda/appointments?date=${date}`),
    refetchInterval: 30_000,
  });
}

/**
 * Clases que se dictan en una fecha: actividades y capacitaciones juntas.
 * Una fila por CLASE, no por inscripta — una clase sin nadie anotado también
 * aparece, que es lo que no se podía ver cuando la grilla se armaba a partir
 * de los turnos.
 */
export function useClasses(date: string) {
  return useQuery({
    queryKey: ["classes", date],
    queryFn: () =>
      api<{ success: boolean; data: ClassOccurrence[] }>(
        `/api/agenda/classes?date=${date}`,
      ).then((r) => r.data),
    refetchInterval: 30_000,
  });
}

/**
 * Roster de una clase (actividad + horario exacto).
 *
 * Una actividad grupal son N turnos distintos con el mismo activity_id y el
 * mismo appointment_start, así que la clase se identifica por ese par y no por
 * el id de un turno puntual.
 */
export function useClassRoster(activityId: string | null, startsAt: string | null) {
  return useQuery({
    queryKey: ["class-roster", activityId, startsAt],
    queryFn: () =>
      api<{ success: boolean; data: ClassRosterEntry[] }>(
        `/api/class-attendance?activityId=${activityId}&startsAt=${encodeURIComponent(startsAt!)}`,
      ).then((r) => r.data),
    enabled: Boolean(activityId && startsAt),
  });
}

export type MarkAttendanceInput = {
  activityId: string;
  startsAt: string;
  entries: { subscriptionId: string; attended: boolean }[];
};

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MarkAttendanceInput) =>
      api<{ success: boolean; data: ClassRosterEntry[] }>("/api/class-attendance", {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["class-roster", variables.activityId, variables.startsAt],
      });
    },
  });
}

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => api<Provider[]>("/api/agenda/providers"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProvidersByService(serviceId: string | null) {
  return useQuery({
    queryKey: ["providers", "by-service", serviceId],
    queryFn: () => api<Provider[]>(`/api/agenda/providers?serviceId=${serviceId}`),
    enabled: Boolean(serviceId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Servicios que ofrece una prestadora — para el alta de turno desde su columna. */
export function useServicesByProvider(providerId: string | null) {
  return useQuery({
    queryKey: ["services", "by-provider", providerId],
    queryFn: () => api<ProviderService[]>(`/api/agenda/providers/${providerId}/services`),
    enabled: Boolean(providerId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyConfig() {
  return useQuery({
    queryKey: ["company-config"],
    queryFn: () => api<CompanyConfig>("/api/agenda/company-config"),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCustomerSearch(q: string) {
  return useQuery({
    queryKey: ["customers", q],
    queryFn: () => api<Customer[]>(`/api/billing/customers?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });
}

/** Una clienta puntual, para cuando la modal se abre con `customerId` ya
 *  resuelto (prefill de depilación, Task 15) y no hay que buscarla. */
export function useCustomer(customerId: string | null) {
  return useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => api<Customer>(`/api/billing/customers/${customerId}`),
    enabled: Boolean(customerId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCustomer() {
  return useMutation({
    mutationFn: (data: { name: string; dni: string; phone?: string; email?: string }) =>
      api<Customer>("/api/billing/customers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

/** Una compra de la clienta con servicios comprados libres para este servicio. */
export type OpcionDeCompra = {
  purchaseId: string;
  descripcion: string;
  /** Cuántos servicios comprados libres le quedan en esa compra. */
  disponibles: number;
  /** ISO, o null si no vence. */
  venceEl: string | null;
  /** El servicio comprado que se descontaría si eligen esta compra. */
  purchaseServiceId: string;
};

/**
 * Qué se le descuenta a la clienta por este turno.
 *
 *   ninguna       no tiene nada a favor: el turno se cobra aparte
 *   automatica    una sola compra con servicios comprados libres → se descuenta sola
 *   elige_laura   varias → Laura elige, ordenadas por lo que vence antes
 */
export type Consumible =
  | { tipo: "ninguna" }
  | { tipo: "automatica"; purchaseServiceId: string; opcion: OpcionDeCompra }
  | { tipo: "elige_laura"; opciones: OpcionDeCompra[] };

/**
 * Lo que la clienta tiene a favor para este servicio.
 *
 * `staleTime: 0` a propósito: entre que se abre la modal y se guarda, otra
 * persona pudo haber agendado ese mismo servicio comprado. Mostrar una lista
 * vieja haría elegir algo que ya no está, y el backend lo rechazaría recién
 * al guardar.
 */
export function useConsumible(customerId: string | null, serviceId: string | null) {
  return useQuery({
    queryKey: ["consumible", customerId, serviceId],
    queryFn: () =>
      api<Consumible>(
        `/api/agenda/appointments/consumible?customerId=${customerId}&serviceId=${serviceId}`,
      ),
    enabled: !!customerId && !!serviceId,
    staleTime: 0,
  });
}

/**
 * El menú de zonas y el presupuesto de minutos para agendar una sesión de
 * depilación puntual (Task 15).
 *
 * `staleTime: 0` por la misma razón que `useConsumible`: entre que se abre
 * la modal y se guarda, otra pestaña pudo haber cobrado o tomado la última
 * sesión libre — mostrar un presupuesto o una puerta de pago viejos haría
 * elegir zonas que después el backend rechaza al guardar.
 */
export function useParaAgendar(purchaseServiceId: string | null, sexo?: Sexo) {
  return useQuery({
    queryKey: ["para-agendar", purchaseServiceId, sexo ?? "auto"],
    queryFn: () =>
      api<DatosParaAgendar>(
        `/api/agenda/depilacion/para-agendar/${purchaseServiceId}${sexo ? `?sexo=${sexo}` : ""}`,
      ),
    enabled: Boolean(purchaseServiceId),
    staleTime: 0,
  });
}

export type CreateAppointmentInput = {
  customerId: string;
  serviceId: string;
  providerId: string;
  machineId?: string;
  start: string;
  priceMode?: "list" | "cash";
  notes?: string;
  status?: "scheduled" | "reserved";
  expiryMinutes?: number;
  /** Seña cobrada al reservar: se factura a ARCA y queda a favor del cliente.
   *  `credit` la paga con el saldo a favor (no entra plata ni se factura). */
  deposit?: {
    amount: number;
    method: "cash" | "bank_transfer" | "mercadopago" | "credit";
  };
  /** El servicio comprado del pack que este turno descuenta. Sin esto no descuenta nada. */
  customerPurchaseServiceId?: string;
  /**
   * Las zonas elegidas para un turno de depilación (1.56.0). Sólo tiene
   * sentido con `serviceId` = el servicio ancla: la duración del turno sale
   * de acá y no del `estimatedDurationMinutes` del servicio.
   */
  zonas?: string[];
  /**
   * Con qué sexo se presupuestó la sesión, cuando Laura pisó el selector
   * (§3.3a). Tiene que viajar: el servidor recalcula la duración por su
   * cuenta —no le cree a la pantalla— y sin este campo la recalculaba con el
   * sexo de la ficha. La pantalla mostraba 15 min y la base guardaba 12.
   */
  sexo?: Sexo;
};

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAppointmentInput) =>
      api<Appointment>("/api/agenda/appointments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      // El turno puede haber descontado una sesión: lo que la clienta tiene a
      // favor quedó viejo.
      queryClient.invalidateQueries({ queryKey: ["consumible"] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    // `consumo` sólo viene al completar: es el descuento de insumos (1.44.0).
    mutationFn: ({ id, ...data }: { id: string; status?: string; notes?: string }) =>
      api<Appointment & { consumo?: Consumo }>(`/api/agenda/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newStart, reason }: { id: string; newStart: string; reason?: string }) =>
      api<Appointment>(`/api/agenda/appointments/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ newStart, ...(reason ? { reason } : {}) }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      // El historial del turno que se acaba de mover: sin esto, reagendar dos
      // veces seguidas muestra el modal con el historial viejo.
      queryClient.invalidateQueries({ queryKey: ["reschedules", variables.id] });
    },
  });
}

/** Historial de movimientos de un turno, del más nuevo al más viejo. */
export function useReschedules(appointmentId: string | null) {
  return useQuery({
    queryKey: ["reschedules", appointmentId],
    queryFn: () => api<Reschedule[]>(`/api/agenda/appointments/${appointmentId}/reschedules`),
    enabled: Boolean(appointmentId),
  });
}
