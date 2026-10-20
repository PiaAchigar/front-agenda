import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

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
