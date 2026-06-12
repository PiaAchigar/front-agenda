import type { Customer, Service, SlotOption } from "../../api/types";

export type BookingState = {
  service: Service | null;
  date: string | null;
  slot: { start: string; end: string; option: SlotOption } | null;
  customer: Customer | null;
  priceMode: "list" | "cash";
};

export const STEPS = ["Servicio", "Fecha", "Horario", "Cliente", "Confirmar"] as const;
