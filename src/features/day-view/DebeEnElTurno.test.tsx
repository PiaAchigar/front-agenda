import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Appointment } from "../../api/types";
import { PastillaDeTurno } from "../week-view/PastillaDeTurno";

// ── Mocks para DayViewPage (mismo set que DayViewPage.vender.test.tsx) ──
const SIN_DATOS: never[] = [];
let turnosDelDia: Appointment[] = [];
const SIN_MUTAR = { mutate: vi.fn(), isPending: false, error: null };

const DE_LA_COMPRA = {
  id: "ap1",
  status: "scheduled",
  customerId: "cu1",
  customerName: "Sofía Herrera",
  serviceName: "Limpieza facial",
  providerId: "prov1",
  providerName: "Gabi",
  appointmentStart: "2027-01-20T13:00:00.000Z",
  appointmentEnd: "2027-01-20T14:00:00.000Z",
  activityId: null,
  activityName: null,
  customerPurchaseServiceId: "cps1",
  customerPurchaseId: "pu1",
  deudaDeLaCompra: 6000,
  notes: null,
  reservationExpiresAt: null,
} as unknown as Appointment;

vi.mock("../../api/agenda", () => ({
  useAppointments: () => ({ data: turnosDelDia, isLoading: false, error: null }),
  useComboPendientes: () => ({ data: undefined, isSuccess: false }),
  useCompanyConfig: () => ({ data: { openHours: SIN_DATOS } }),
  useProviderSchedule: () => ({ data: SIN_DATOS }),
  useProviders: () => ({ data: [{ id: "prov1", name: "Gabi" }] }),
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
vi.mock("../../api/ventas", () => ({
  useEstadoDeCobro: () => ({ data: { pendiente: 6000, minimo: 0, sugerido: 6000, faltaElMinimo: false }, error: null }),
}));
vi.mock("../vender/CobrarPaso", () => ({
  CobrarPaso: ({ compraId, pendiente, onCobrado }: { compraId: string; pendiente: number; onCobrado: (r: number) => void }) => (
    <div>
      <p>COBRAR {compraId} {pendiente}</p>
      <button onClick={() => onCobrado(pendiente)}>confirmar cobro</button>
    </div>
  ),
}));
vi.mock("./CalendarGrid", () => ({
  CalendarGrid: ({ onAppointmentClick }: { onAppointmentClick: (a: unknown) => void }) => (
    <button onClick={() => onAppointmentClick(DE_LA_COMPRA)}>abrir turno de compra</button>
  ),
}));
vi.mock("../../lib/embed", async (orig) => ({ ...(await orig<typeof import("../../lib/embed")>()), isEmbedded: true }));

const { DayViewPage } = await import("./DayViewPage");

afterEach(() => window.history.pushState({}, "", "/dia"));

describe("Debe $X — tarjeta del día", () => {
  // CalendarGrid real (el mock de arriba sólo aplica al import de DayViewPage).
  it("la tarjeta de un turno con deuda dice Debe $6.000 sin tapar el nombre", async () => {
    const real = await vi.importActual<typeof import("./CalendarGrid")>("./CalendarGrid");
    render(
      <real.CalendarGrid
        date="2027-01-20"
        providers={[{ id: "prov1", name: "Gabi" }]}
        openHours={[{ dayOfWeek: 3, openingTime: "08:00", closingTime: "20:00", isOpen: true }]}
        appointments={[DE_LA_COMPRA]}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Debe $6.000")).toBeInTheDocument();
    expect(screen.getByText("Sofía Herrera")).toBeInTheDocument();
  });

  it("sin deuda no hay etiqueta", async () => {
    const real = await vi.importActual<typeof import("./CalendarGrid")>("./CalendarGrid");
    render(
      <real.CalendarGrid
        date="2027-01-20"
        providers={[{ id: "prov1", name: "Gabi" }]}
        openHours={[{ dayOfWeek: 3, openingTime: "08:00", closingTime: "20:00", isOpen: true }]}
        appointments={[{ ...DE_LA_COMPRA, deudaDeLaCompra: 0 }]}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
      />,
    );
    expect(screen.queryByText(/debe/i)).not.toBeInTheDocument();
  });
});

describe("Debe $X — ficha de la pastilla de la semana", () => {
  function pastilla(t: Appointment) {
    render(<PastillaDeTurno turno={t} color={undefined} carril={0} total={1} top={0} alto={40} onAbrir={vi.fn()} />);
  }
  it("la ficha dice Debe $6.000, la pastilla no", () => {
    pastilla(DE_LA_COMPRA);
    expect(screen.queryByText(/debe/i)).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Debe $6.000");
  });
  it("sin deuda la ficha no dice nada", () => {
    pastilla({ ...DE_LA_COMPRA, deudaDeLaCompra: null } as Appointment);
    fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
    expect(screen.getByRole("tooltip")).not.toHaveTextContent(/debe/i);
  });
});

describe("Debe $X — detalle del turno", () => {
  function montar() {
    turnosDelDia = [DE_LA_COMPRA];
    const qc = new QueryClient();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    window.history.pushState({}, "", "/dia?date=2027-01-20");
    render(
      <QueryClientProvider client={qc}>
        <BrowserRouter><DayViewPage /></BrowserRouter>
      </QueryClientProvider>,
    );
    return invalidar;
  }

  it("tiene Cobrar $6.000 sobre la compra, y el Cobrar común sigue sin aparecer", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText("abrir turno de compra"));
    expect(screen.queryByRole("button", { name: /^cobrar$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cobrar $6.000" }));
    expect(screen.getByText("COBRAR pu1 6000")).toBeInTheDocument();
  });

  it("el detalle dice Debe $6.000 y, al cobrar y releerse el turno con deuda 0, ya no dice nada ni ofrece cobrar", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient();
    turnosDelDia = [DE_LA_COMPRA];
    window.history.pushState({}, "", "/dia?date=2027-01-20");
    const arbol = () => (
      <QueryClientProvider client={qc}>
        <BrowserRouter><DayViewPage /></BrowserRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(arbol());
    await user.click(screen.getByText("abrir turno de compra"));
    expect(screen.getByText("Debe $6.000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cobrar $6.000" }));
    await user.click(screen.getByText("confirmar cobro"));
    expect(screen.queryByText("confirmar cobro")).not.toBeInTheDocument();
    // La lista se relee con la deuda en cero.
    turnosDelDia = [{ ...DE_LA_COMPRA, deudaDeLaCompra: 0 } as Appointment];
    rerender(arbol());
    expect(screen.queryByText(/^Debe/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cobrar \$/i })).not.toBeInTheDocument();
  });

  it("un turno sin deuda no ofrece cobrar la compra", async () => {
    const user = userEvent.setup();
    DE_LA_COMPRA.deudaDeLaCompra = 0;
    try {
      montar();
      await user.click(screen.getByText("abrir turno de compra"));
      expect(screen.queryByRole("button", { name: /^cobrar \$/i })).not.toBeInTheDocument();
    } finally {
      DE_LA_COMPRA.deudaDeLaCompra = 6000;
    }
  });
});
