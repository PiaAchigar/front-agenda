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
let datosDepilacion: DatosParaAgendar = {
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

const cobrar = vi.fn((_i: unknown, o?: { onSuccess?: (r: unknown) => void }) => o?.onSuccess?.({ pendiente: 0 }));
vi.mock("../../api/ventas", () => ({
  useEstadoDeCobro: () => ({ data: { pendiente: 4000, minimo: 1600, sugerido: 4000, faltaElMinimo: false }, error: null }),
  useCobrarCompra: () => ({ mutate: cobrar, isPending: false, error: null }),
}));
vi.mock("../../api/agenda", () => ({
  useAvailability: (serviceId: string | null, date: string | null) => ({
    data: date
      ? { date, serviceId, durationMinutes: 30, slots: ["09:00", "10:00", "11:00"].map((start) => ({ start, end: start, options: [] })) }
      : undefined,
    isFetching: false,
    isLoading: false,
  }),
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

const PUERTA_ORIGINAL = datosDepilacion.puerta;
beforeEach(() => {
  datosDepilacion = { ...datosDepilacion, puerta: PUERTA_ORIGINAL };
  cobrar.mockClear();
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
  it("no dibuja clienta ni servicio (los muestra el orquestador) pero sí el día y la hora", () => {
    render(<FormularioAgendar onClose={() => {}} encabezado={ENCABEZADO} />);
    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
    expect(screen.queryByText("Servicio")).not.toBeInTheDocument();
    expect(screen.queryByText(/Seleccioná un servicio/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Hora inicio" })).toBeInTheDocument();
  });

  it("cada cambio de día u hora se avisa hacia arriba", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const avisar = vi.fn();
    render(<FormularioAgendar onClose={() => {}} encabezado={{ ...ENCABEZADO, minutos: null }} onCambiarFechaHora={avisar} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Hora inicio" }), "10:00");
    expect(avisar).toHaveBeenLastCalledWith("2027-01-20", 600);
  });

  it("con serviceId ofrece las prestadoras de ese servicio", () => {
    render(<FormularioAgendar onClose={() => {}} encabezado={ENCABEZADO} />);
    expect(screen.getByRole("option", { name: /^Gabi/ })).toBeInTheDocument();
  });

  it("con purchaseServiceId muestra el menú de zonas", () => {
    render(
      <FormularioAgendar
        onClose={() => {}}
        encabezado={{ ...ENCABEZADO, serviceId: null, purchaseServiceId: "ps-depi", compraPreferidaId: null }}
      />,
    );
    expect(screen.getByText("Pierna entera")).toBeInTheDocument();
  });

  it("Confirmar crea el turno con la fecha, la hora y la compra preferida", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<FormularioAgendar onClose={() => {}} encabezado={ENCABEZADO} />);
    await user.click(await screen.findByRole("button", { name: /^agendar$/i }));
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
        onClose={() => {}}
        encabezado={{ ...ENCABEZADO, minutos: null }}
      />,
    );
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeDisabled();
  });
});

describe("FormularioAgendar — la puerta de pago de depilación (#18)", () => {
  const ENCABEZADO_DEPI = { ...ENCABEZADO, serviceId: null, purchaseServiceId: "ps-depi", compraPreferidaId: null, compraId: "pu-depi" };
  const sinPlata = () => {
    datosDepilacion = { ...datosDepilacion, puerta: { puedeAgendar: false, puedeReservar: true, motivo: "Falta el 40%", faltaCobrar: 4000 } };
  };

  it("si falta plata, ofrece 'Cobrar lo que falta' y Agendar sigue apagado", () => {
    sinPlata();
    render(<FormularioAgendar onClose={() => {}} encabezado={ENCABEZADO_DEPI} />);
    expect(screen.getByRole("button", { name: "Cobrar lo que falta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeDisabled();
  });

  it("cobra sobre esa compra y, al cobrar, vuelve a leer la puerta", async () => {
    sinPlata();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<FormularioAgendar onClose={() => {}} encabezado={ENCABEZADO_DEPI} />);
    await user.click(screen.getByRole("button", { name: "Cobrar lo que falta" }));
    await user.click(screen.getByRole("button", { name: /^cobrar \$/i }));
    expect(cobrar).toHaveBeenCalledWith(
      { id: "pu-depi", amount: 4000, method: "cash", wantsInvoice: false },
      expect.anything(),
    );
    // El cobro invalida `para-agendar`: la puerta llega nueva y Agendar se habilita.
    datosDepilacion = { ...datosDepilacion, puerta: PUERTA_ORIGINAL };
    rerender(<FormularioAgendar onClose={() => {}} encabezado={ENCABEZADO_DEPI} />);
    expect(screen.queryByRole("button", { name: "Cobrar lo que falta" })).not.toBeInTheDocument();
  });

  it("sin compra conocida no ofrece cobrar", () => {
    sinPlata();
    render(<FormularioAgendar onClose={() => {}} encabezado={{ ...ENCABEZADO_DEPI, compraId: null }} />);
    expect(screen.queryByRole("button", { name: "Cobrar lo que falta" })).not.toBeInTheDocument();
  });
});
