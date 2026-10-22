// Espejo de los tipos de `api-sistema-central/src/repositories/planificador.repo.ts`.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { CreateAppointmentInput } from "./agenda";
import type { Availability } from "./types";

export type SesionPlanificable = {
  purchaseServiceId: string;
  vuelta: number; // customer_purchase_service.repeticion
  orden: number; // dentro de la vuelta, el orden del combo/promo (1..n)
  nombre: string;
  serviceId: string; // en depilación, el servicio ancla
  esDepilacion: boolean;
  zonas: string[]; // depilación: TODAS las del pack (sin las "a elección"); si no, []
  duracionMinutos: number; // servicio: su duración; depilación: minutosElegidos(zonas) para el sexo de la clienta
  juntos: boolean; // el combo de la línea está marcado "se hacen juntos"
};

export type BaseDelPlanificador = {
  compraId: string;
  customerId: string;
  clienta: string; // nombre para los textos
  descripcion: string;
  intervalo: { dias: number; cargado: boolean };
  venceEl: string | null; // YYYY-MM-DD, de la vigencia de la compra
  puerta: { total: number; pagado: number; minimo: number } | null; // sólo depilación
  turnosDeLaClienta: { start: string; end: string }[]; // futuros, no cancelados
  sesiones: SesionPlanificable[]; // libres, ordenadas por vuelta y orden
};

export type ConsultaDeDisponibilidad = {
  serviceId: string;
  date: string;
  durationMinutes?: number;
};

/** La base de una compra para armar el planificador. Sin compra, no pide nada. */
export function useBasePlanificador(compraId: string | null) {
  return useQuery({
    queryKey: ["planificador", compraId],
    queryFn: () => api<BaseDelPlanificador>(`/api/agenda/planificador/${compraId}`),
    enabled: !!compraId,
  });
}

/** Disponibilidad de varias consultas en un solo request. Lista vacía: no pide nada. */
export function useDisponibilidadEnLote(consultas: ConsultaDeDisponibilidad[]) {
  return useQuery({
    queryKey: ["availability", "lote", consultas],
    queryFn: () =>
      api<{ resultados: Availability[] }>("/api/agenda/availability/lote", {
        method: "POST",
        body: JSON.stringify({ consultas }),
      }),
    enabled: consultas.length > 0,
  });
}

/** Agenda un lote de turnos, todo o nada. Un error trae `indice` (el turno que falló). */
export function useAgendarLote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { turnos: CreateAppointmentInput[] }) =>
      api<{ turnos: unknown[] }>("/api/agenda/appointments/lote", {
        method: "POST",
        body: JSON.stringify({ turnos: input.turnos }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      queryClient.invalidateQueries({ queryKey: ["ventas"] });
    },
  });
}
