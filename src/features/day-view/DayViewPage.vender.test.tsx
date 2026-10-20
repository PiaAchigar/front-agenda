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
  useProvidersByServices: () => ({ porServicio: new Map(), cargando: false }),
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
// El Nuevo turno se reemplaza por un espía: lo que se prueba acá es el
// CABLEADO de DayViewPage (qué se abre, con qué día y qué prefill).
vi.mock("../nuevo-turno/NuevoTurnoModal", () => ({
  NuevoTurnoModal: ({ date, prefill, onCambiarDia }: {
    date: string; prefill: unknown; onCambiarDia?: (d: string) => void;
  }) => (
    <div>
      <p>NUEVO TURNO {date}</p>
      <pre data-testid="prefill">{JSON.stringify(prefill)}</pre>
      <button onClick={() => onCambiarDia?.("2027-02-03")}>simular venta en otro día</button>
    </div>
  ),
}));

const { DayViewPage } = await import("./DayViewPage");

afterEach(() => window.history.pushState({}, "", "/dia"));

function montar(search = "?date=2027-01-20") {
  window.history.pushState({}, "", `/dia${search}`);
  render(<BrowserRouter><DayViewPage /></BrowserRouter>);
}

describe("DayViewPage — Nuevo turno", () => {
  it("el hueco abre el Nuevo turno único, con el día y la prestadora del hueco", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText(/hueco de gabi/i));
    expect(screen.getByText("NUEVO TURNO 2027-01-20")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId("prefill").textContent!)).toMatchObject({ providerId: "prov1", minutes: 930 });
  });

  it("si se vende para otro día, la grilla se mueve a ese día", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText(/hueco de gabi/i));
    await user.click(screen.getByText(/simular venta en otro día/i));
    expect(new URLSearchParams(window.location.search).get("date")).toBe("2027-02-03");
    expect(await screen.findByText("NUEVO TURNO 2027-02-03")).toBeInTheDocument();
  });
});
