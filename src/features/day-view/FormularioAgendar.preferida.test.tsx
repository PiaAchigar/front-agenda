import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Consumible } from "../../api/agenda";

const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", phone: null, email: null, creditBalance: "0" };
const opcion = (purchaseId: string, purchaseServiceId: string, descripcion: string) => ({
  purchaseId, purchaseServiceId, descripcion, disponibles: 1, venceEl: null,
});
const consumible: Consumible = {
  tipo: "elige_laura",
  opciones: [opcion("pu-vieja", "ps-vieja", "Pack viejo"), opcion("pu-nueva", "ps-nueva", "Pack recién vendido")],
};
const SIN_MUTAR = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null };

vi.mock("../../api/agenda", () => ({
  useAvailability: (serviceId: string | null, date: string | null) => ({
    data: date
      ? { date, serviceId, durationMinutes: 30, slots: ["09:00", "10:00"].map((start) => ({ start, end: start, options: [] })) }
      : undefined,
    isFetching: false,
    isLoading: false,
  }),
  // Días y horarios libres para el selector de día/hora de "Agendar".
  useMonthAvailability: (_s: unknown, _p: unknown, month: string) => ({
    data: { month, availableDays: ["2027-01-20"] },
    isFetching: false,
  }),
  useComboPendientes: () => ({ data: undefined, isSuccess: false, isError: false }),
  useConsumible: () => ({ data: consumible, isFetching: false }),
  useCreateAppointment: () => SIN_MUTAR,
  useCreateCustomer: () => SIN_MUTAR,
  useCustomer: () => ({ data: CLIENTA }),
  useCustomerSearch: () => ({ data: [], isFetching: false }),
  useParaAgendar: () => ({ data: undefined, isFetching: false }),
  useProvidersByService: () => ({ data: [], isFetching: false }),
  useServices: () => ({ data: [{ id: "svc-a", name: "Limpieza facial", estimatedDurationMinutes: 30 }] }),
  useServicesByProvider: () => ({ data: [{ id: "svc-a", name: "Limpieza facial", estimatedDurationMinutes: 30 }], isFetching: false }),
}));

const { FormularioAgendar } = await import("./NewAppointmentModal");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
});

// Los tests usan 2027-01-20: se fija "ahora" antes para que `yaPaso` no dependa del reloj real.
afterEach(() => {
  vi.useRealTimers();
});

describe("FormularioAgendar — lo que agrega Vender desde el turno", () => {
  it("con compraPreferidaId, arranca elegida la compra recién vendida", async () => {
    render(
      <FormularioAgendar
        onClose={() => {}}
        encabezado={{ fecha: "2027-01-20", minutos: 600, customer: CLIENTA, serviceId: "svc-a", purchaseServiceId: null, compraPreferidaId: "pu-nueva" }}
      />,
    );
    expect(await screen.findByRole("radio", { name: /pack recién vendido/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /pack viejo/i })).not.toBeChecked();
  });

  it("sin compraPreferidaId, no arranca ninguna elegida (como hoy)", async () => {
    render(
      <FormularioAgendar onClose={() => {}} encabezado={{ fecha: "2027-01-20", minutos: 600, customer: CLIENTA, serviceId: "svc-a", purchaseServiceId: null, compraPreferidaId: null }} />,
    );
    expect(await screen.findByRole("radio", { name: /pack recién vendido/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /no descontar/i })).toBeChecked();
  });

  it("depilación con profesional de la columna: queda fija", () => {
    render(
      <FormularioAgendar
        onClose={() => {}}
        prestadoraFija={{ providerId: "prov1", providerName: "Gabi" }}
        encabezado={{ fecha: "2027-01-20", minutos: 600, customer: CLIENTA, serviceId: null, purchaseServiceId: "ps-depi", compraPreferidaId: null }}
      />,
    );
    const fija = screen.getByRole("option", { name: "Gabi" }).closest("select")!;
    expect(fija).toBeDisabled();
  });
});
