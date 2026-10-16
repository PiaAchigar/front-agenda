import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosParaAgendar } from "../../api/types";
import { AVISO_HORARIO_PASADO } from "../../lib/horario";

const crear = vi.fn();
const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", creditBalance: 0 };
const PROVEEDORA = { id: "prov1", fullName: "Gabi", specialties: null };
const SERVICIO = { id: "svc-a", name: "Limpieza facial", estimatedDurationMinutes: 30 };

const datosDepilacion: DatosParaAgendar = {
  nombreDelPack: "Cuerpo Full",
  sesion: 1,
  sesionesTotales: 3,
  presupuestoMinutos: 60,
  zonasDeRegalo: 0,
  sexo: "mujer",
  zonas: [{ id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 9, esDeRegalo: false, disponible: true, motivo: null }],
  puerta: { puedeAgendar: true, puedeReservar: true, motivo: null, faltaCobrar: 0 },
  serviceId: "svc-ancla",
};

// Días libres que devuelve el mock para cualquier mes.
let diasLibres: string[] = [];
let horariosLibres: string[] = ["09:00", "10:00", "11:00"];

vi.mock("../../api/agenda", async () => {
  const { useEffect, useState } = await import("react");
  return {
  useAvailability: (serviceId: string | null, date: string | null) => ({
    data: date
      ? { date, serviceId, durationMinutes: 30, slots: horariosLibres.map((start) => ({ start, end: start, options: [] })) }
      : undefined,
    isFetching: false,
    isLoading: false,
  }),
  useMonthAvailability: (_s: unknown, _p: unknown, month: string) => ({
    data: { month, availableDays: diasLibres },
    isFetching: false,
  }),
  useComboPendientes: () => ({ data: undefined, isSuccess: false, isError: false }),
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomer: (id: string | null) => ({ data: id ? CLIENTA : undefined }),
  useCustomerSearch: () => ({ data: [CLIENTA], isFetching: false }),
  useParaAgendar: () => ({ data: datosDepilacion, isFetching: false, error: null }),
  // Como el hook real: la lista llega después del primer render (el modal
  // asigna la prestadora recién cuando la lista cambia).
  useProvidersByService: (serviceId: string | null) => {
    const [llego, setLlego] = useState(false);
    useEffect(() => setLlego(true), []);
    return { data: serviceId && llego ? [PROVEEDORA] : [], isFetching: false };
  },
  useServices: () => ({ data: [SERVICIO] }),
  useServicesByProvider: () => ({ data: [SERVICIO], isFetching: false }),
  };
});

const { NewAppointmentModal } = await import("./NewAppointmentModal");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-16T12:30:00Z")); // 09:30 ART
  crear.mockClear();
  diasLibres = ["2026-10-20", "2026-10-22"];
  horariosLibres = ["09:00", "10:00", "11:00"];
});
afterEach(() => {
  vi.useRealTimers();
});

const usuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
const select = (nombre: string) => screen.getByRole("combobox", { name: nombre }) as HTMLSelectElement;

async function elegirClientaYServicio(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/nombre, dni/i), "Sofía");
  await user.click(await screen.findByText(/Sofía Herrera/));
  await user.selectOptions(screen.getAllByRole("combobox")[0]!, "svc-a");
}

describe("NewAppointmentModal — día y hora en Agendar", () => {
  it("desde un hueco arranca en ese día y hora, y crea el turno con el día elegido", async () => {
    const user = usuario();
    render(
      <NewAppointmentModal
        open
        date="2026-10-20"
        prefill={{ providerId: "prov1", providerName: "Gabi", minutes: 600 }}
        onClose={() => {}}
      />,
    );
    await elegirClientaYServicio(user);
    expect(screen.getByRole("button", { name: "20" })).toHaveAttribute("aria-pressed", "true");
    expect(select("Hora inicio").value).toBe("10:00");

    await user.click(screen.getByRole("button", { name: "22" }));
    expect(select("Hora inicio").value).toBe("");
    await user.selectOptions(select("Hora inicio"), "11:00");
    await user.click(screen.getByRole("button", { name: /confirmar turno/i }));

    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0]![0].start).toBe("2026-10-22T11:00:00-03:00");
  });

  it("desde '+ Nuevo turno' no hay hora elegida y Confirmar turno está apagado", async () => {
    const user = usuario();
    render(<NewAppointmentModal open date="2026-10-20" prefill={null} onClose={() => {}} />);
    await elegirClientaYServicio(user);
    expect(select("Hora inicio").value).toBe("");
    expect(screen.getByRole("button", { name: /confirmar turno/i })).toBeDisabled();
  });

  it("sin hora elegida, 'Hora fin' queda vacía (no 01:00)", async () => {
    const user = usuario();
    render(<NewAppointmentModal open date="2026-10-20" prefill={null} onClose={() => {}} />);
    await elegirClientaYServicio(user);
    expect(select("Hora inicio").value).toBe("");
    const horaFin = screen.getByText(/Hora fin/).parentElement!.querySelector("input") as HTMLInputElement;
    expect(horaFin.value).toBe("");
  });

  it("desde 'A agendar' arranca en el primer día libre y sin hora", async () => {
    // El primer día libre es el 22, no el 20 que trae la grilla.
    diasLibres = ["2026-10-22", "2026-10-25"];
    render(
      <NewAppointmentModal
        open
        date="2026-10-20"
        prefill={{ customerId: "cu1", serviceId: "svc-a" }}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText("Jue 22/10/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "22" })).toHaveAttribute("aria-pressed", "true");
    expect(select("Hora inicio").value).toBe("");
  });

  it("depilación con una hora pasada: avisa y apaga Agendar y Reservar 24 h", async () => {
    const user = usuario();
    diasLibres = ["2026-10-16", "2026-10-20"];
    render(
      <NewAppointmentModal
        open
        date="2026-10-20"
        prefill={{ customerId: "cu1", purchaseServiceId: "l1", providerId: "prov1", providerName: "Gabi" }}
        onClose={() => {}}
      />,
    );
    await user.click(await screen.findByRole("checkbox", { name: /pierna entera/i }));
    fireEvent.change(screen.getByLabelText("Hora inicio"), { target: { value: "09:00" } });

    expect(await screen.findByText(AVISO_HORARIO_PASADO)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reservar 24 h/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Hora inicio"), { target: { value: "10:00" } });
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeEnabled();
  });

  it("una hora de la grilla que no está libre se descarta, avisa y apaga Confirmar", async () => {
    const user = usuario();
    horariosLibres = ["11:00"];
    render(
      <NewAppointmentModal
        open
        date="2026-10-20"
        prefill={{ providerId: "prov1", providerName: "Gabi", minutes: 600 }}
        onClose={() => {}}
      />,
    );
    await elegirClientaYServicio(user);
    expect(await screen.findByText("El horario 10:00 no está libre con esta prestadora. Elegí otro.")).toBeInTheDocument();
    expect(select("Hora inicio").value).toBe("");
    expect(screen.getByRole("button", { name: /confirmar turno/i })).toBeDisabled();
  });

  it("una hora de la grilla que sí está libre se conserva y deja confirmar", async () => {
    const user = usuario();
    horariosLibres = ["10:00", "11:00"];
    render(
      <NewAppointmentModal
        open
        date="2026-10-20"
        prefill={{ providerId: "prov1", providerName: "Gabi", minutes: 600 }}
        onClose={() => {}}
      />,
    );
    await elegirClientaYServicio(user);
    expect(select("Hora inicio").value).toBe("10:00");
    expect(screen.queryByText(/no está libre/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar turno/i })).toBeEnabled();
  });
});
