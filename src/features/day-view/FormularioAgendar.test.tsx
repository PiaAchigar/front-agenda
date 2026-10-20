import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Consumible } from "../../api/agenda";
import type { DatosParaAgendar } from "../../api/types";

const crear = vi.fn();
const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", phone: null, email: null, creditBalance: "0" };
const PROVEEDORA = { id: "prov1", fullName: "Gabi", specialties: null };
const opcion = (purchaseId: string, purchaseServiceId: string, descripcion: string) => ({
  purchaseId, purchaseServiceId, descripcion, disponibles: 1, venceEl: null,
});
const consumible: Consumible = {
  tipo: "elige_laura",
  opciones: [opcion("pu-vieja", "ps-vieja", "Pack viejo"), opcion("pu-nueva", "ps-nueva", "Pack recién vendido")],
};
const datosDepilacion: DatosParaAgendar = {
  nombreDelPack: "Cuerpo Full",
  sesion: 1,
  sesionesTotales: 3,
  presupuestoMinutos: 60,
  zonasDeRegalo: 0,
  sexo: "mujer",
  zonas: [
    { id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 9, esDeRegalo: false, disponible: true, motivo: null },
  ],
  puerta: { puedeAgendar: true, puedeReservar: true, motivo: "", faltaCobrar: 0 },
  serviceId: "svc-ancla",
};

vi.mock("../../api/agenda", () => ({
  useAvailability: () => ({ data: undefined, isFetching: false, isLoading: false }),
  useMonthAvailability: (_s: unknown, _p: unknown, month: string) => ({
    data: { month, availableDays: [] },
    isFetching: false,
  }),
  useComboPendientes: () => ({ data: undefined, isSuccess: false, isError: false }),
  useConsumible: () => ({ data: consumible, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomer: () => ({ data: undefined }),
  useCustomerSearch: () => ({ data: [], isFetching: false }),
  useParaAgendar: (id: string | null) => ({ data: id ? datosDepilacion : undefined, isFetching: false }),
  useProvidersByService: (serviceId: string | null) => ({
    data: serviceId ? [PROVEEDORA] : [],
    isFetching: false,
  }),
  useServices: () => ({ data: [{ id: "svc-a", name: "Limpieza facial", estimatedDurationMinutes: 30 }] }),
  useServicesByProvider: () => ({ data: [], isFetching: false }),
}));

const { FormularioAgendar } = await import("./NewAppointmentModal");

beforeEach(() => {
  crear.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const ENCABEZADO = {
  fecha: "2027-01-20",
  minutos: 600,
  customer: CLIENTA,
  serviceId: "svc-a",
  purchaseServiceId: null,
  compraPreferidaId: "pu-nueva",
};

describe("FormularioAgendar con encabezado", () => {
  it("no dibuja clienta, servicio ni día/hora: los muestra el orquestador", () => {
    render(<FormularioAgendar date="2027-01-20" prefill={null} onClose={() => {}} encabezado={ENCABEZADO} />);
    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
    expect(screen.queryByText("Servicio")).not.toBeInTheDocument();
    expect(screen.queryByText(/Seleccioná un servicio/)).not.toBeInTheDocument();
    expect(screen.queryByText("Día")).not.toBeInTheDocument();
    expect(screen.queryByText("Hora inicio")).not.toBeInTheDocument();
  });

  it("con serviceId ofrece las prestadoras de ese servicio", () => {
    render(<FormularioAgendar date="2027-01-20" prefill={null} onClose={() => {}} encabezado={ENCABEZADO} />);
    expect(screen.getByRole("option", { name: "Gabi" })).toBeInTheDocument();
  });

  it("con purchaseServiceId muestra el menú de zonas", () => {
    render(
      <FormularioAgendar
        date="2027-01-20"
        prefill={null}
        onClose={() => {}}
        encabezado={{ ...ENCABEZADO, serviceId: null, purchaseServiceId: "ps-depi", compraPreferidaId: null }}
      />,
    );
    expect(screen.getByText("Pierna entera")).toBeInTheDocument();
  });

  it("Confirmar crea el turno con la fecha, la hora y la compra preferida", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<FormularioAgendar date="2027-01-20" prefill={null} onClose={() => {}} encabezado={ENCABEZADO} />);
    await user.click(await screen.findByRole("button", { name: /confirmar turno/i }));
    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear.mock.calls[0]![0]).toMatchObject({
      customerId: "cu1",
      serviceId: "svc-a",
      providerId: "prov1",
      start: "2027-01-20T10:00:00-03:00",
      customerPurchaseServiceId: "ps-nueva",
    });
  });

  it("sin hora elegida no deja confirmar", () => {
    render(
      <FormularioAgendar
        date="2027-01-20"
        prefill={null}
        onClose={() => {}}
        encabezado={{ ...ENCABEZADO, minutos: null }}
      />,
    );
    expect(screen.getByRole("button", { name: /confirmar turno/i })).toBeDisabled();
  });
});
