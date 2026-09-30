import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Consumible } from "../../api/agenda";
import type { Availability } from "../../api/types";

const crear = vi.fn((_data: unknown, opts?: { onSuccess?: (r: unknown) => void }) => {
  opts?.onSuccess?.({ id: "appt-1" });
});
const crearAsync = vi.fn().mockResolvedValue({ id: "appt-2" });

const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", creditBalance: 0 };
const PROVEEDORA = { id: "prov1", fullName: "Gabi", specialties: null };
const SERVICIO = { id: "svc-a", name: "Limpieza facial", estimatedDurationMinutes: 30 };

let consumibleState: Consumible = {
  tipo: "automatica",
  purchaseServiceId: "ps-a",
  opcion: { purchaseId: "pu-1", descripcion: "Combo Facial", disponibles: 1, venceEl: null, purchaseServiceId: "ps-a" },
};
let respuestaComboPendientes: {
  data?: { pendientes: { purchaseServiceId: string; serviceId: string; serviceName: string }[] };
  isSuccess: boolean;
  isError: boolean;
} = { data: { pendientes: [] }, isSuccess: true, isError: false };
const disponibilidadHermano: { data?: Availability; isLoading: boolean } = { data: undefined, isLoading: true };

vi.mock("../../api/agenda", () => ({
  useAvailability: () => disponibilidadHermano,
  useComboPendientes: (purchaseServiceId: string | null) =>
    purchaseServiceId ? respuestaComboPendientes : { data: undefined, isSuccess: false, isError: false },
  useConsumible: () => ({ data: consumibleState, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, mutateAsync: crearAsync, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomer: () => ({ data: undefined }),
  useCustomerSearch: () => ({ data: [CLIENTA], isFetching: false }),
  useParaAgendar: () => ({ data: undefined, isFetching: false }),
  useProvidersByService: (serviceId: string | null) => ({
    data: serviceId ? [PROVEEDORA] : [],
    isFetching: false,
  }),
  useServices: () => ({ data: [SERVICIO] }),
  useServicesByProvider: () => ({ data: [], isFetching: false }),
}));

const { NewAppointmentModal } = await import("./NewAppointmentModal");

beforeEach(() => {
  crear.mockClear();
  consumibleState = {
    tipo: "automatica",
    purchaseServiceId: "ps-a",
    opcion: { purchaseId: "pu-1", descripcion: "Combo Facial", disponibles: 1, venceEl: null, purchaseServiceId: "ps-a" },
  };
  respuestaComboPendientes = { data: { pendientes: [] }, isSuccess: true, isError: false };
  disponibilidadHermano.data = undefined;
  disponibilidadHermano.isLoading = true;
});

async function confirmarPrimerTurno(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/nombre, dni/i), "Sofía");
  await user.click(await screen.findByText(/Sofía Herrera/));
  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[0]!, "svc-a");
  await user.click(screen.getByRole("button", { name: /confirmar turno/i }));
}

describe("NewAppointmentModal — V3c, combos que se hacen juntos", () => {
  it("con hermanos pendientes, muestra el panel en vez de cerrar", async () => {
    const user = userEvent.setup();
    respuestaComboPendientes = {
      data: { pendientes: [{ purchaseServiceId: "ps-b", serviceId: "svc-b", serviceName: "Peeling" }] },
      isSuccess: true,
      isError: false,
    };
    const onClose = vi.fn();
    render(<NewAppointmentModal open date="2027-01-20" prefill={null} onClose={onClose} />);
    await confirmarPrimerTurno(user);

    expect(await screen.findByText(/este combo tiene 1 servicio más/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sin hermanos pendientes, el modal se cierra solo — como hoy", async () => {
    const user = userEvent.setup();
    respuestaComboPendientes = { data: { pendientes: [] }, isSuccess: true, isError: false };
    const onClose = vi.fn();
    render(<NewAppointmentModal open date="2027-01-20" prefill={null} onClose={onClose} />);
    await confirmarPrimerTurno(user);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("un turno sin compra detrás nunca pide los pendientes del combo", async () => {
    const user = userEvent.setup();
    consumibleState = { tipo: "ninguna" };
    // A propósito con contenido: si el gate estuviera mal (pidiera igual),
    // esto se vería en pantalla y el test lo notaría.
    respuestaComboPendientes = {
      data: { pendientes: [{ purchaseServiceId: "x", serviceId: "svc-b", serviceName: "Peeling" }] },
      isSuccess: true,
      isError: false,
    };
    const onClose = vi.fn();
    render(<NewAppointmentModal open date="2027-01-20" prefill={null} onClose={onClose} />);
    await confirmarPrimerTurno(user);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/servicio más/i)).not.toBeInTheDocument();
  });

  // Hallazgo de la revisión final: mientras la consulta de pendientes todavía
  // no resolvió (ni éxito ni error), el formulario viejo seguía en pantalla
  // con "Confirmar turno" habilitado — un segundo click creaba un turno
  // duplicado del que ya se había creado.
  it("mientras se consulta el combo, el botón de confirmar queda apagado", async () => {
    const user = userEvent.setup();
    respuestaComboPendientes = { data: undefined, isSuccess: false, isError: false };
    render(<NewAppointmentModal open date="2027-01-20" prefill={null} onClose={vi.fn()} />);
    await confirmarPrimerTurno(user);

    expect(screen.getByRole("button", { name: /confirmar turno/i })).toBeDisabled();
  });

  // Hallazgo del reviewer de Task 4: el turno ya se creó bien cuando esta
  // consulta se dispara. Si falla (red caída, 500), el modal no puede
  // quedar colgado con "Confirmar turno" habilitado — el turno ya existe,
  // apretarlo de nuevo lo duplicaría.
  it("si la consulta de pendientes falla, el modal se cierra igual — el turno ya se creó", async () => {
    const user = userEvent.setup();
    respuestaComboPendientes = { data: undefined, isSuccess: false, isError: true };
    const onClose = vi.fn();
    render(<NewAppointmentModal open date="2027-01-20" prefill={null} onClose={onClose} />);
    await confirmarPrimerTurno(user);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
