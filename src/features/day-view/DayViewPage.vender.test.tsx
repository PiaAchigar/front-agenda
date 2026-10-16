import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// Referencias estables entre renders (ver la nota en DayViewPage.test.tsx).
const SIN_DATOS: never[] = [];
const SIN_MUTAR = { mutate: vi.fn(), isPending: false, error: null };
const PROVEEDORAS = [{ id: "prov1", name: "Gabi" }];
const CONFIG_VACIA = { openHours: SIN_DATOS };

// Mismo set de hooks que el mock de DayViewPage.test.tsx: AttendanceModal,
// ReagendarTurnoModal y AvisoInsumosModal se montan siempre.
vi.mock("../../api/agenda", () => ({
  useAppointments: () => ({ data: SIN_DATOS, isLoading: false, error: null }),
  useComboPendientes: () => ({ data: undefined, isSuccess: false }),
  useCompanyConfig: () => ({ data: CONFIG_VACIA }),
  useProviderSchedule: () => ({ data: SIN_DATOS }),
  useProviders: () => ({ data: PROVEEDORAS }),
  useUpdateAppointment: () => SIN_MUTAR,
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => SIN_MUTAR,
  useCreateCustomer: () => SIN_MUTAR,
  useCustomer: () => ({ data: undefined }),
  useCustomerSearch: () => ({ data: SIN_DATOS, isFetching: false }),
  useParaAgendar: () => ({ data: undefined, isFetching: false }),
  useProvidersByService: () => ({ data: SIN_DATOS, isFetching: false }),
  useServices: () => ({ data: SIN_DATOS }),
  useServicesByProvider: () => ({ data: SIN_DATOS, isFetching: false }),
  useClassRoster: () => ({ data: SIN_DATOS, isLoading: false }),
  useMarkAttendance: () => SIN_MUTAR,
  useRescheduleAppointment: () => SIN_MUTAR,
  useReschedules: () => ({ data: SIN_DATOS }),
  useAvailability: () => ({ data: undefined, isFetching: false, isLoading: false }),
  useMonthAvailability: () => ({ data: undefined, isFetching: false }),
}));
vi.mock("./CalendarGrid", () => ({
  CalendarGrid: ({ onSlotClick }: { onSlotClick: (c: string, m: number) => void }) => (
    <button onClick={() => onSlotClick("prov1", 930)}>hueco de Gabi a las 15:30</button>
  ),
}));
// Los dos modales se reemplazan por espías: lo que se prueba acá es el
// CABLEADO de DayViewPage (qué se abre, con qué día y qué prefill).
vi.mock("./NewAppointmentModal", () => ({
  NewAppointmentModal: ({ date, prefill, solapas }: { date: string; prefill: unknown; solapas?: ReactNode }) => (
    <div>
      {solapas}
      <p>AGENDAR {date}</p>
      <pre data-testid="prefill">{JSON.stringify(prefill)}</pre>
    </div>
  ),
}));
vi.mock("../vender/VenderYAgendar", () => ({
  VenderYAgendar: ({ date, hueco, solapas, onAgendar }: {
    date: string; hueco: unknown; solapas: ReactNode;
    onAgendar: (t: { date: string; prefill: unknown }) => void;
  }) => (
    <div>
      {solapas}
      <p>VENDER {date} {JSON.stringify(hueco)}</p>
      <button onClick={() => onAgendar({ date: "2027-02-03", prefill: { customerId: "cu1", serviceId: "svc-a", compraPreferidaId: "pu9", minutes: 600 } })}>
        simular venta en otro día
      </button>
    </div>
  ),
}));

const { DayViewPage } = await import("./DayViewPage");

afterEach(() => window.history.pushState({}, "", "/dia"));

function montar(search = "?date=2027-01-20") {
  window.history.pushState({}, "", `/dia${search}`);
  render(<BrowserRouter><DayViewPage /></BrowserRouter>);
}

describe("DayViewPage — Vender y agendar", () => {
  it("el hueco abre Agendar, como hoy, con las dos solapas", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText(/hueco de gabi/i));
    expect(screen.getByText("AGENDAR 2027-01-20")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Agendar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Vender y agendar" })).toBeInTheDocument();
  });

  it("la solapa Vender y agendar recibe el hueco (profesional y hora)", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText(/hueco de gabi/i));
    await user.click(screen.getByRole("tab", { name: "Vender y agendar" }));
    expect(screen.getByText(/VENDER 2027-01-20/)).toHaveTextContent('"providerId":"prov1"');
    expect(screen.getByText(/VENDER 2027-01-20/)).toHaveTextContent('"minutes":930');
  });

  it("al vender en otro día, la grilla se mueve a ese día y Agendar abre con la compra", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText(/hueco de gabi/i));
    await user.click(screen.getByRole("tab", { name: "Vender y agendar" }));
    await user.click(screen.getByText(/simular venta en otro día/i));
    expect(await screen.findByText("AGENDAR 2027-02-03")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("date")).toBe("2027-02-03");
    expect(JSON.parse(screen.getByTestId("prefill").textContent!)).toEqual({
      customerId: "cu1", serviceId: "svc-a", compraPreferidaId: "pu9", minutes: 600,
    });
  });
});
