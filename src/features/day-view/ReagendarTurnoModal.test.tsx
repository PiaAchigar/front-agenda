import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Appointment } from "../../api/types";

const h = vi.hoisted(() => ({
  mutate: vi.fn(),
  errorDelPatch: null as Error | null,
  llamadasAlMes: [] as unknown[][],
  historial: [] as unknown[],
  // días libres y horarios libres por proveedora
  DIAS: ["2026-10-19", "2026-10-20", "2026-10-26"],
  SLOTS: {
    p1: ["10:00", "11:00"],
    p2: ["15:00"],
  } as Record<string, string[]>,
}));

vi.mock("../../api/agenda", () => ({
  useProvidersByService: () => ({
    data: [
      { id: "p1", fullName: "Gabi" },
      { id: "p2", fullName: "Lu" },
    ],
  }),
  useMonthAvailability: (...args: unknown[]) => {
    h.llamadasAlMes.push(args);
    return { data: { month: args[2], availableDays: h.DIAS }, isFetching: false };
  },
  useAvailability: (
    serviceId: string | null,
    date: string | null,
    opts: { providerId?: string; excludeAppointmentId?: string } = {},
  ) => ({
    data: date
      ? {
          date,
          serviceId,
          durationMinutes: 30,
          slots: (h.SLOTS[opts.providerId ?? ""] ?? []).map((start) => ({
            start,
            end: `${String(Number(start.slice(0, 2))).padStart(2, "0")}:30`,
            options: [{ providerId: opts.providerId, providerName: "x", machineId: null }],
          })),
        }
      : undefined,
    isFetching: false,
    isLoading: false,
  }),
  useReschedules: () => ({ data: h.historial }),
  useRescheduleAppointment: () => ({ mutate: h.mutate, isPending: false, error: h.errorDelPatch }),
}));

const { ReagendarTurnoModal } = await import("./ReagendarTurnoModal");

// 13:00Z = 10:00 en Argentina, lunes 19 de octubre de 2026.
const turno = {
  id: "a1",
  appointmentStart: "2026-10-19T13:00:00.000Z",
  appointmentEnd: "2026-10-19T13:30:00.000Z",
  customerName: "Ana",
  serviceId: "s1",
  serviceName: "Limpieza de cutis",
  providerId: "p1",
  providerName: "Gabi",
} as Appointment;

function abrir() {
  return render(<ReagendarTurnoModal open appointment={turno} onClose={() => {}} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T15:00:00Z"));
  h.mutate.mockClear();
  h.llamadasAlMes.length = 0;
  h.historial = [];
  h.errorDelPatch = null;
});
afterEach(() => vi.useRealTimers());

describe("ReagendarTurnoModal", () => {
  it("se titula 'Reagenda el turno' y muestra la clienta y el servicio sin poder tocarlos", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Reagenda el turno" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ana")).toBeDisabled();
    expect(screen.getByDisplayValue("Limpieza de cutis")).toBeDisabled();
  });

  it("arranca con la prestadora, el día y la hora actuales del turno", () => {
    abrir();
    expect(screen.getByLabelText("Prestadora")).toHaveValue("p1");
    expect(screen.getByRole("button", { name: "19" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Hora inicio")).toHaveValue("10:00");
  });

  it("la prestadora se elige entre las que ofrecen ese servicio", () => {
    abrir();
    const select = screen.getByLabelText("Prestadora");
    expect(within(select).getByRole("option", { name: "Gabi" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Lu" })).toBeInTheDocument();
  });

  it("pide el calendario del mes del turno, para el servicio, la prestadora y el propio turno", () => {
    abrir();
    expect(h.llamadasAlMes[0]).toEqual(["s1", "p1", "2026-10", "a1"]);
  });

  it("la hora sólo ofrece los horarios libres de esa prestadora ese día", () => {
    abrir();
    const horas = within(screen.getByLabelText("Hora inicio"))
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(horas).toEqual(["10:00", "11:00"]);
  });

  it("cambiar la prestadora limpia el día y la hora, y vuelve a pedir el calendario para la nueva", async () => {
    const user = userEvent.setup();
    abrir();
    await user.selectOptions(screen.getByLabelText("Prestadora"), "p2");

    expect(screen.getByRole("button", { name: "19" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /confirmar reagendado/i })).toBeDisabled();
    expect(h.llamadasAlMes.at(-1)).toEqual(["s1", "p2", "2026-10", "a1"]);
  });

  it("tras cambiar de prestadora, la hora ofrece SÓLO los horarios de la nueva", async () => {
    const user = userEvent.setup();
    abrir();
    await user.selectOptions(screen.getByLabelText("Prestadora"), "p2");
    await user.click(screen.getByRole("button", { name: "20" }));

    const horas = within(screen.getByLabelText("Hora inicio"))
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(horas).toEqual(["15:00"]);
  });

  it("sin cambiar de prestadora NO manda providerId (el camino de siempre)", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "26" }));
    await user.selectOptions(screen.getByLabelText("Hora inicio"), "11:00");
    await user.click(screen.getByRole("button", { name: /confirmar reagendado/i }));

    expect(h.mutate).toHaveBeenCalledTimes(1);
    const payload = h.mutate.mock.calls[0]![0];
    expect(payload).toMatchObject({ id: "a1", newStart: "2026-10-26T11:00:00-03:00" });
    expect(payload.providerId).toBeUndefined();
  });

  it("cambiando de prestadora SÍ manda providerId", async () => {
    const user = userEvent.setup();
    abrir();
    await user.selectOptions(screen.getByLabelText("Prestadora"), "p2");
    await user.click(screen.getByRole("button", { name: "20" }));
    await user.selectOptions(screen.getByLabelText("Hora inicio"), "15:00");
    await user.click(screen.getByRole("button", { name: /confirmar reagendado/i }));

    expect(h.mutate.mock.calls[0]![0]).toMatchObject({
      id: "a1",
      newStart: "2026-10-20T15:00:00-03:00",
      providerId: "p2",
    });
  });

  it("el motivo viaja recortado, y en blanco no viaja", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByPlaceholderText(/la clienta no podía/i), "  se enfermó  ");
    await user.click(screen.getByRole("button", { name: /confirmar reagendado/i }));
    expect(h.mutate.mock.calls[0]![0].reason).toBe("se enfermó");
  });

  it("no hay nada para cobrar: ni Precio ni Seña", () => {
    abrir();
    expect(screen.queryByText(/precio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/seña/i)).not.toBeInTheDocument();
  });

  it("el historial muestra el cambio de prestadora", () => {
    h.historial = [
      {
        id: "r1",
        previousStart: "2026-10-12T13:00:00.000Z",
        previousEnd: "2026-10-12T13:30:00.000Z",
        newStart: "2026-10-19T13:00:00.000Z",
        newEnd: "2026-10-19T13:30:00.000Z",
        reason: "pidió con Lu",
        createdAt: "2026-10-05T13:00:00.000Z",
        rescheduledByName: null,
        previousProviderName: "Gabi",
        newProviderName: "Lu",
      },
    ];
    abrir();
    expect(screen.getByText(/ya se movió 1 vez/i)).toBeInTheDocument();
    expect(screen.getByText(/Gabi → Lu/)).toBeInTheDocument();
  });

  it("muestra el error si el backend rechaza el reagendado", () => {
    h.errorDelPatch = new Error("No se puede cambiar de proveedora en un turno de depilación al reagendar");
    abrir();
    expect(screen.getByText(/depilación al reagendar/i)).toBeInTheDocument();
  });
});
