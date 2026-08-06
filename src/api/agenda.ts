import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Appointment,
  Availability,
  Category,
  ClassOccurrence,
  ClassRosterEntry,
  CompanyConfig,
  Customer,
  Provider,
  Service,
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

export function useCreateCustomer() {
  return useMutation({
    mutationFn: (data: { name: string; dni: string; phone?: string; email?: string }) =>
      api<Customer>("/api/billing/customers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
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
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string; notes?: string }) =>
      api<Appointment>(`/api/agenda/appointments/${id}`, {
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
    mutationFn: ({ id, newStart }: { id: string; newStart: string }) =>
      api<Appointment>(`/api/agenda/appointments/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ newStart }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}
