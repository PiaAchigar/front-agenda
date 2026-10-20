import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Las columnas de la grilla del día siguen a la búsqueda de la barra:
 * `?prestadora=` deja una sola columna, `?servicio=` deja las prestadoras
 * que hacen ese servicio. La grilla es la de verdad.
 */

const SIN_DATOS: never[] = [];
const SIN_MUTAR = { mutate: vi.fn(), isPending: false };
const SIN_MUTAR_CON_ERROR = { ...SIN_MUTAR, error: null };
const CONFIG_VACIA = { openHours: SIN_DATOS };
const PRESTADORAS = [
  { id: "p1", fullName: "Ana", specialties: null },
  { id: "p2", fullName: "Bea", specialties: null },
  { id: "p3", fullName: "Cleo", specialties: null },
];
const SERVICIOS = [{ id: "s1", name: "Rostro" }];

vi.mock("../../api/agenda", () => ({
  useAppointments: () => ({ data: SIN_DATOS, isLoading: false, error: null }),
  useComboPendientes: () => ({ data: undefined, isSuccess: false }),
  useCompanyConfig: () => ({ data: CONFIG_VACIA }),
  useProviderSchedule: () => ({ data: SIN_DATOS }),
  useProviders: () => ({ data: PRESTADORAS }),
  useUpdateAppointment: () => SIN_MUTAR,
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => ({ ...SIN_MUTAR, error: null }),
  useCreateCustomer: () => SIN_MUTAR,
  useCustomer: () => ({ data: undefined }),
  useCustomerSearch: () => ({ data: SIN_DATOS, isFetching: false }),
  useParaAgendar: () => ({ data: undefined, isFetching: false }),
  useProvidersByService: (serviceId: string | null) => ({
    data: serviceId === "s2" ? [PRESTADORAS[0], PRESTADORAS[1]] : serviceId ? [PRESTADORAS[0]] : undefined,
    isFetching: false,
  }),
  useServices: () => ({ data: SERVICIOS }),
  useServicesByProvider: () => ({ data: SIN_DATOS, isFetching: false }),
  // `AttendanceModal`, `ReagendarTurnoModal` y `AvisoInsumosModal` se montan
  // SIEMPRE (se apagan por prop, no por `&&`), así que sus hooks corren en
  // cada render aunque el modal esté cerrado.
  useClassRoster: () => ({ data: SIN_DATOS, isLoading: false }),
  useMarkAttendance: () => SIN_MUTAR,
  useRescheduleAppointment: () => SIN_MUTAR_CON_ERROR,
  useReschedules: () => ({ data: SIN_DATOS }),
  useAvailability: () => ({ data: undefined, isFetching: false, isLoading: false }),
  useMonthAvailability: () => ({ data: undefined, isFetching: false }),
}));

const { DayViewPage } = await import("./DayViewPage");

function montar(search: string) {
  window.history.pushState({}, "", `/dia${search}`);
  const { container } = render(
    <BrowserRouter>
      <DayViewPage />
    </BrowserRouter>,
  );
  // Una columna = sus huecos: `slot-<providerId>-<minutos>`.
  const columnas = new Set(
    [...container.querySelectorAll('[data-testid^="slot-"]')].map((e) =>
      e.getAttribute("data-testid")!.split("-")[1],
    ),
  );
  return [...columnas].sort();
}

afterEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/dia");
});

describe("DayViewPage — la búsqueda filtra las columnas", () => {
  it("sin búsqueda están todas las prestadoras", () => {
    expect(montar("?date=2026-10-19")).toEqual(["p1", "p2", "p3"]);
  });

  it("?prestadora=p2 deja sólo la columna de p2", () => {
    expect(montar("?date=2026-10-19&prestadora=p2")).toEqual(["p2"]);
  });

  it("?servicio=s1 deja sólo las prestadoras de ese servicio", () => {
    expect(montar("?date=2026-10-19&servicio=s1")).toEqual(["p1"]);
  });

  it("?servicio=s2&con=p2 deja sólo la columna de la prestadora elegida en 'La hacen:'", () => {
    expect(montar("?date=2026-10-19&servicio=s2")).toEqual(["p1", "p2"]);
    expect(montar("?date=2026-10-19&servicio=s2&con=p2")).toEqual(["p2"]);
  });
});
