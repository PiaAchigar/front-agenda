import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Availability } from "../../api/types";

const crearAsync = vi.fn();

let disponibilidadPorServicio: Record<string, { data?: Availability; isLoading: boolean }> = {};

vi.mock("../../api/agenda", () => ({
  useAvailability: (serviceId: string | null) =>
    disponibilidadPorServicio[serviceId ?? ""] ?? { data: undefined, isLoading: true },
  useCreateAppointment: () => ({ mutateAsync: crearAsync, isPending: false, error: null }),
}));

const { ComboPendientesPanel } = await import("./ComboPendientesPanel");

const PENDIENTE_A = { purchaseServiceId: "ps-a", serviceId: "svc-a", serviceName: "Limpieza facial" };
const PENDIENTE_B = { purchaseServiceId: "ps-b", serviceId: "svc-b", serviceName: "Peeling" };

const SLOT_TEMPRANO: Availability["slots"][number] = {
  start: "10:00",
  end: "10:30",
  options: [{ providerId: "prov1", providerName: "Gabi", machineId: null }],
};
const SLOT_TARDE: Availability["slots"][number] = {
  start: "11:00",
  end: "11:30",
  options: [
    { providerId: "prov1", providerName: "Gabi", machineId: null },
    { providerId: "prov2", providerName: "Vale", machineId: null },
  ],
};

beforeEach(() => {
  crearAsync.mockReset();
  crearAsync.mockResolvedValue({ id: "appt-x" });
  disponibilidadPorServicio = {};
});

describe("ComboPendientesPanel", () => {
  it("sugiere el hueco más temprano de cualquiera calificada", async () => {
    disponibilidadPorServicio["svc-a"] = {
      data: { date: "2027-01-20", serviceId: "svc-a", durationMinutes: 30, slots: [SLOT_TEMPRANO, SLOT_TARDE] },
      isLoading: false,
    };
    render(
      <ComboPendientesPanel
        date="2027-01-20"
        customerId="cu1"
        pendientes={[PENDIENTE_A]}
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(await screen.findByDisplayValue("10:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Gabi")).toBeInTheDocument();
  });

  it("lo que Laura elige a mano es lo que se manda al confirmar, no la sugerencia", async () => {
    const user = userEvent.setup();
    disponibilidadPorServicio["svc-a"] = {
      data: { date: "2027-01-20", serviceId: "svc-a", durationMinutes: 30, slots: [SLOT_TEMPRANO, SLOT_TARDE] },
      isLoading: false,
    };
    render(
      <ComboPendientesPanel
        date="2027-01-20"
        customerId="cu1"
        pendientes={[PENDIENTE_A]}
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await screen.findByDisplayValue("10:00");
    await user.selectOptions(screen.getByDisplayValue("10:00"), "11:00");
    await user.selectOptions(screen.getByDisplayValue("Gabi"), "prov2");
    await user.click(screen.getByRole("button", { name: /agendar/i }));

    await waitFor(() =>
      expect(crearAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: "prov2",
          start: "2027-01-20T11:00:00-03:00",
          customerPurchaseServiceId: "ps-a",
          serviceId: "svc-a",
          customerId: "cu1",
        }),
      ),
    );
  });

  it("una fila sin horario libre no entra al botón, y no bloquea a las demás", async () => {
    disponibilidadPorServicio["svc-a"] = {
      data: { date: "2027-01-20", serviceId: "svc-a", durationMinutes: 30, slots: [] },
      isLoading: false,
    };
    disponibilidadPorServicio["svc-b"] = {
      data: { date: "2027-01-20", serviceId: "svc-b", durationMinutes: 30, slots: [SLOT_TEMPRANO] },
      isLoading: false,
    };
    render(
      <ComboPendientesPanel
        date="2027-01-20"
        customerId="cu1"
        pendientes={[PENDIENTE_A, PENDIENTE_B]}
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const aviso = await screen.findByText(/no queda horario el 20\/01 para/i);
    expect(aviso).toHaveTextContent("Limpieza facial");
    expect(screen.getByRole("button", { name: /agendar el que queda/i })).toBeInTheDocument();
  });

  it("si una fila choca al confirmar, la otra queda agendada y el panel no cierra solo", async () => {
    const user = userEvent.setup();
    disponibilidadPorServicio["svc-a"] = {
      data: { date: "2027-01-20", serviceId: "svc-a", durationMinutes: 30, slots: [SLOT_TEMPRANO] },
      isLoading: false,
    };
    disponibilidadPorServicio["svc-b"] = {
      data: { date: "2027-01-20", serviceId: "svc-b", durationMinutes: 30, slots: [SLOT_TEMPRANO] },
      isLoading: false,
    };
    crearAsync
      .mockResolvedValueOnce({ id: "appt-1" })
      .mockRejectedValueOnce(new Error("La prestadora no está disponible para este servicio en esa fecha"));
    const onDone = vi.fn();
    render(
      <ComboPendientesPanel
        date="2027-01-20"
        customerId="cu1"
        pendientes={[PENDIENTE_A, PENDIENTE_B]}
        onDone={onDone}
        onCancel={vi.fn()}
      />,
    );
    await screen.findAllByDisplayValue("10:00");
    await user.click(screen.getByRole("button", { name: /agendar los 2 que quedan/i }));

    await waitFor(() => expect(screen.getByText(/✓ agendado/i)).toBeInTheDocument());
    expect(await screen.findByText(/la prestadora no está disponible/i)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("confirmar con éxito en todas las filas llama a onDone", async () => {
    const user = userEvent.setup();
    disponibilidadPorServicio["svc-a"] = {
      data: { date: "2027-01-20", serviceId: "svc-a", durationMinutes: 30, slots: [SLOT_TEMPRANO] },
      isLoading: false,
    };
    const onDone = vi.fn();
    render(
      <ComboPendientesPanel
        date="2027-01-20"
        customerId="cu1"
        pendientes={[PENDIENTE_A]}
        onDone={onDone}
        onCancel={vi.fn()}
      />,
    );
    await screen.findByDisplayValue("10:00");
    await user.click(screen.getByRole("button", { name: /agendar/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("el botón se apaga mientras envía, para no mandar el mismo turno dos veces", async () => {
    const user = userEvent.setup();
    disponibilidadPorServicio["svc-a"] = {
      data: { date: "2027-01-20", serviceId: "svc-a", durationMinutes: 30, slots: [SLOT_TEMPRANO] },
      isLoading: false,
    };
    let resolver: (v: unknown) => void = () => {};
    crearAsync.mockReturnValue(new Promise((r) => (resolver = r)));
    render(
      <ComboPendientesPanel
        date="2027-01-20"
        customerId="cu1"
        pendientes={[PENDIENTE_A]}
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await screen.findByDisplayValue("10:00");
    const boton = screen.getByRole("button", { name: /agendar/i });
    await user.click(boton);

    expect(boton).toBeDisabled();
    resolver({ id: "appt-1" });
  });

  // Hallazgo del revisor de Task 3: tras una falla parcial, la fila que SÍ
  // se agendó seguía contando en "aConfirmar" — un segundo click la volvía
  // a mandar, y aunque el backend la rechaza (ya está tomada, no duplica el
  // turno), la pantalla le pisaba el "✓ Agendado" con un error falso.
  it("después de una falla parcial, reintentar no vuelve a mandar la fila que ya se agendó", async () => {
    const user = userEvent.setup();
    disponibilidadPorServicio["svc-a"] = {
      data: { date: "2027-01-20", serviceId: "svc-a", durationMinutes: 30, slots: [SLOT_TEMPRANO] },
      isLoading: false,
    };
    disponibilidadPorServicio["svc-b"] = {
      data: { date: "2027-01-20", serviceId: "svc-b", durationMinutes: 30, slots: [SLOT_TEMPRANO] },
      isLoading: false,
    };
    crearAsync
      .mockResolvedValueOnce({ id: "appt-1" })
      .mockRejectedValueOnce(new Error("La prestadora no está disponible para este servicio en esa fecha"))
      .mockResolvedValueOnce({ id: "appt-3" });
    render(
      <ComboPendientesPanel
        date="2027-01-20"
        customerId="cu1"
        pendientes={[PENDIENTE_A, PENDIENTE_B]}
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await screen.findAllByDisplayValue("10:00");
    await user.click(screen.getByRole("button", { name: /agendar los 2 que quedan/i }));
    await waitFor(() => expect(screen.getByText(/✓ agendado/i)).toBeInTheDocument());

    // Reintento: sólo debería mandar la que falló.
    await user.click(screen.getByRole("button", { name: /agendar el que queda/i }));
    await waitFor(() => expect(crearAsync).toHaveBeenCalledTimes(3));

    expect(crearAsync).not.toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ customerPurchaseServiceId: "ps-a" }),
    );
    // Las dos filas terminan agendadas — la primera nunca perdió su "✓
    // Agendado", la segunda lo ganó en el reintento.
    expect(screen.getAllByText(/✓ agendado/i)).toHaveLength(2);
    expect(screen.queryByText(/no está disponible/i)).not.toBeInTheDocument();
  });
});
