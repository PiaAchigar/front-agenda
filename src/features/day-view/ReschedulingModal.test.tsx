import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReschedulingModal } from "./ReschedulingModal";
import type { Appointment } from "../../api/types";

const mutate = vi.fn();
const historial = { data: [] as unknown[] };

vi.mock("../../api/agenda", () => ({
  useRescheduleAppointment: () => ({ mutate, isPending: false, error: null }),
  useReschedules: () => historial,
}));

const turno = {
  id: "a1",
  appointmentStart: "2026-09-15T13:00:00.000Z",
  customerName: "Ana",
  serviceName: "Limpieza de cutis",
  providerName: "Gabi",
} as Appointment;

function abrir() {
  return render(<ReschedulingModal open appointment={turno} onClose={() => {}} />);
}

beforeEach(() => {
  mutate.mockClear();
  historial.data = [];
});

describe("ReschedulingModal", () => {
  it("prellena la fecha y la hora argentinas del turno", () => {
    abrir();
    // 13:00 UTC son las 10:00 en Argentina. Si mostrara 13:00, quien reagenda
    // creería que el turno está tres horas más tarde de lo que está.
    expect(screen.getByDisplayValue("2026-09-15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10:00")).toBeInTheDocument();
  });

  it("manda el motivo que se escribió", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByPlaceholderText(/la clienta no podía/i), "se enfermó");
    await user.click(screen.getByRole("button", { name: /confirmar reagendado/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toMatchObject({ id: "a1", reason: "se enfermó" });
  });

  it("sin motivo no manda el campo, en vez de mandar cadena vacía", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /confirmar reagendado/i }));
    // Una cadena vacía se guardaría como motivo "" y el historial mostraría un
    // renglón de motivo en blanco.
    expect(mutate.mock.calls[0]![0].reason).toBeUndefined();
  });

  it("un motivo de puros espacios tampoco viaja", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByPlaceholderText(/la clienta no podía/i), "   ");
    await user.click(screen.getByRole("button", { name: /confirmar reagendado/i }));
    expect(mutate.mock.calls[0]![0].reason).toBeUndefined();
  });

  it("sin movimientos previos no muestra el bloque de historial", () => {
    abrir();
    expect(screen.queryByText(/ya se movió/i)).not.toBeInTheDocument();
  });

  it("muestra cuántas veces se movió y de dónde a dónde", () => {
    historial.data = [
      {
        id: "m1",
        previousStart: "2026-09-10T13:00:00.000Z",
        previousEnd: "2026-09-10T14:00:00.000Z",
        newStart: "2026-09-15T13:00:00.000Z",
        newEnd: "2026-09-15T14:00:00.000Z",
        reason: "la clienta pidió cambiarlo",
        createdAt: "2026-09-08T12:00:00.000Z",
        rescheduledByName: null,
      },
    ];
    abrir();
    expect(screen.getByText(/ya se movió 1 vez/i)).toBeInTheDocument();
    expect(screen.getByText(/la clienta pidió cambiarlo/)).toBeInTheDocument();
  });

  it("con dos movimientos dice 'veces', no 'vez'", () => {
    const base = {
      previousStart: "2026-09-10T13:00:00.000Z",
      previousEnd: "2026-09-10T14:00:00.000Z",
      newStart: "2026-09-15T13:00:00.000Z",
      newEnd: "2026-09-15T14:00:00.000Z",
      reason: null,
      createdAt: "2026-09-08T12:00:00.000Z",
      rescheduledByName: null,
    };
    historial.data = [
      { ...base, id: "m1" },
      { ...base, id: "m2" },
    ];
    abrir();
    expect(screen.getByText(/ya se movió 2 veces/i)).toBeInTheDocument();
  });

  it("un movimiento sin quién lo hizo igual se muestra", () => {
    // `rescheduledByName` viene null casi siempre: sólo 2 de los 11 usuarios de
    // producción tienen el cruce cargado. La fecha y el motivo son lo que
    // importa y no pueden depender de eso.
    historial.data = [
      {
        id: "m1",
        previousStart: "2026-09-10T13:00:00.000Z",
        previousEnd: null,
        newStart: "2026-09-15T13:00:00.000Z",
        newEnd: "2026-09-15T14:00:00.000Z",
        reason: null,
        createdAt: "2026-09-08T12:00:00.000Z",
        rescheduledByName: null,
      },
    ];
    abrir();
    expect(screen.getByText(/ya se movió 1 vez/i)).toBeInTheDocument();
  });
});
