import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Appointment,
  Availability,
  Category,
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

export function useAppointments(date: string) {
  return useQuery({
    queryKey: ["appointments", date],
    queryFn: () => api<Appointment[]>(`/api/agenda/appointments?date=${date}`),
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
