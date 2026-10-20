import { useMutation, useQueryClient } from "@tanstack/react-query";
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
