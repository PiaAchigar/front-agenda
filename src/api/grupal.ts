import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { ClassOccurrence } from "./types";

/**
 * Saca a una anotada de una clase: cancela su turno. No es un borrado, el
 * turno queda `cancelled` (y se vuelve a anotar con "Anotar").
 */
export function useSacarDeClase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      api(`/api/agenda/appointments/${appointmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export type CuotaDelMes = {
  billingCycleId: string;
  mes: string;
  cuota: number;
  pagado: number;
  debe: number;
  isPaid: boolean;
};

/** La cuota de una suscripción en un mes (YYYY-MM): cuánto es, cuánto se pagó y cuánto debe. */
export function useCuotaDelMes(subscriptionId: string | null, mes: string | null) {
  return useQuery({
    queryKey: ["cuota-del-mes", subscriptionId, mes],
    queryFn: () => api<CuotaDelMes>(`/api/training-subscriptions/${subscriptionId}/cuota?mes=${mes}`),
    enabled: !!subscriptionId && !!mes,
  });
}

export type CobrarCuotaInput = {
  subscriptionId: string;
  mes: string;
  amount: number;
  method: string;
  wantsInvoice: boolean;
};

export function useCobrarCuota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionId, ...body }: CobrarCuotaInput) =>
      api<{ cuota: CuotaDelMes }>(`/api/training-subscriptions/${subscriptionId}/cobrar`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["cuota-del-mes"] });
    },
  });
}

export type OpcionesParaAnotar = {
  anotadaAlMes: boolean;
  suscripcion: "activa" | "pausada" | null;
  puedePrueba: boolean;
  cuotaSugerida: number;
  horariosDelMes: string[];
  subscriptionId: string | null;
  clasesDelPlan: number | null;
  horarios: { scheduleId: string; etiqueta: string; maquina: string | null; proveedora: string | null; clases: number }[];
};

/** Qué se le puede ofrecer a una clienta en una actividad, para un mes (YYYY-MM). */
export function useOpcionesParaAnotar(activityId: string, customerId: string | null, mes: string) {
  return useQuery({
    queryKey: ["opciones-anotar", activityId, customerId, mes],
    queryFn: () =>
      api<{ success: boolean; data: OpcionesParaAnotar }>(
        `/api/agenda/classes/opciones?activityId=${activityId}&customerId=${customerId}&mes=${mes}`,
      ).then((r) => r.data),
    enabled: !!customerId,
  });
}

export type AnotarAlMesInput = {
  activityId: string;
  customerId: string;
  mes: string;
  scheduleIds: string[];
  cuota: number;
};

export type AnotarAlMesResultado = {
  subscriptionId: string;
  billingCycleId: string;
  anotadas: number;
  /** ISO de las clases que no tuvieron lugar */
  sinLugar: string[];
  superaPlan: boolean;
  clasesDelMes: number;
};

function invalidarClases(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["classes"] });
  queryClient.invalidateQueries({ queryKey: ["appointments"] });
  queryClient.invalidateQueries({ queryKey: ["opciones-anotar"] });
}

export function useAnotarAlMes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnotarAlMesInput) =>
      api<{ success: boolean; data: AnotarAlMesResultado }>("/api/agenda/classes/anotar-al-mes", {
        method: "POST",
        body: JSON.stringify(body),
      }).then((r) => r.data),
    onSuccess: () => invalidarClases(queryClient),
  });
}

export type AnotarAClaseInput = {
  activityId: string;
  startsAt: string;
  customerId: string;
  scheduleId?: string;
  prueba?: boolean;
};

export function useAnotarAClase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnotarAClaseInput) =>
      api<{ success: boolean; data: { appointmentId: string } }>("/api/agenda/classes/anotar-a-clase", {
        method: "POST",
        body: JSON.stringify(body),
      }).then((r) => r.data),
    onSuccess: () => invalidarClases(queryClient),
  });
}

export type OpcionesDeCapacitacion = {
  compraId: string | null;
  debe: number;
  encuentrosAnotada: number;
  encuentrosQueQuedan: number;
};

/** Si la clienta compró la capacitación y en cuántos de los encuentros que quedan está anotada. */
export function useOpcionesDeCapacitacion(trainingId: string, customerId: string | null) {
  return useQuery({
    queryKey: ["opciones-capacitacion", trainingId, customerId],
    queryFn: () =>
      api<{ success: boolean; data: OpcionesDeCapacitacion }>(
        `/api/agenda/classes/opciones-capacitacion?trainingId=${trainingId}&customerId=${customerId}`,
      ).then((r) => r.data),
    enabled: !!customerId,
  });
}

export type AnotarACapacitacionResultado = {
  anotada: number;
  yaEstaba: number;
  /** session_number de los encuentros sin lugar */
  sinLugar: number[];
};

export function useAnotarACapacitacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { trainingId: string; customerId: string }) =>
      api<{ success: boolean; data: AnotarACapacitacionResultado }>("/api/agenda/classes/anotar-a-capacitacion", {
        method: "POST",
        body: JSON.stringify(body),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["opciones-capacitacion"] });
    },
  });
}

export type OpcionGrupal = { id: string; name: string };

/** Las actividades (para el buscador y los chips de Turnos grupales). */
export function useActividades() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: () => api<OpcionGrupal[]>("/api/agenda/activities"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Las capacitaciones (para el buscador y los chips de Turnos grupales). */
export function useCapacitaciones() {
  return useQuery({
    queryKey: ["trainings"],
    queryFn: () => api<OpcionGrupal[]>("/api/agenda/trainings"),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Las clases de un rango de días (la semana) en un solo pedido. Su clave empieza
 * con "classes": las mutaciones que invalidan `["classes"]` lo refrescan también.
 */
export function useClassesRange(from: string, to: string) {
  return useQuery({
    queryKey: ["classes", from, to],
    queryFn: () =>
      api<{ success: boolean; data: ClassOccurrence[] }>(`/api/agenda/classes?from=${from}&to=${to}`).then(
        (r) => r.data,
      ),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData, // al navegar queda a la vista el rango anterior
  });
}
