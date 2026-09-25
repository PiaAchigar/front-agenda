import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosParaAgendar } from "../../api/types";

const crear = vi.fn();
const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", creditBalance: 0 };
const PROVEEDORA = { id: "prov1", fullName: "Gabi", specialties: null };

/**
 * `serviceId` es el ancla de depilación resuelto — hoy el backend real NO lo
 * manda (ver `DatosParaAgendar.serviceId` en `api/types.ts` y el reporte de
 * la Task 15): este mock simula el día en que lo agregue, para poder probar
 * el resto del cableado (selección de zonas, puerta de pago, los dos
 * botones) sin quedar bloqueado por ese hueco del backend.
 */
const datosDepilacion: DatosParaAgendar = {
  nombreDelPack: "Cuerpo Full",
  sesion: 1,
  sesionesTotales: 3,
  presupuestoMinutos: 60,
  sexo: "mujer",
  zonas: [
    { id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 9, esDeRegalo: false, disponible: true, motivo: null },
    { id: "z2", nombre: "Axila", categoria: "chica", minutos: 3, esDeRegalo: false, disponible: true, motivo: null },
  ],
  puerta: {
    puedeAgendar: false,
    puedeReservar: true,
    motivo: "Para agendar hace falta al menos el 40%",
    faltaCobrar: 24000,
  },
  serviceId: "svc-ancla",
};

vi.mock("../../api/agenda", () => ({
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomer: () => ({ data: CLIENTA }),
  useCustomerSearch: () => ({ data: [], isFetching: false }),
  useParaAgendar: () => ({ data: datosDepilacion, isFetching: false }),
  useProvidersByService: (serviceId: string | null) => ({
    data: serviceId ? [PROVEEDORA] : [],
    isFetching: false,
  }),
  useServices: () => ({ data: [] }),
  useServicesByProvider: () => ({ data: [], isFetching: false }),
}));

const { NewAppointmentModal } = await import("./NewAppointmentModal");

beforeEach(() => {
  crear.mockClear();
});

function abrir() {
  render(
    <NewAppointmentModal
      open
      date="2027-01-20"
      prefill={{ customerId: "cu1", purchaseServiceId: "l1" }}
      onClose={() => {}}
    />,
  );
}

describe("NewAppointmentModal — turno de depilación", () => {
  it('dice de qué pack y sesión se trata, y muestra el menú en vez del selector de servicio', async () => {
    abrir();
    expect(await screen.findByText(/cuerpo full.*sesión 1 de 3/i)).toBeInTheDocument();
    expect(screen.queryByText("Servicio")).not.toBeInTheDocument();
  });

  it("sin elegir ninguna zona, los dos botones quedan apagados", async () => {
    abrir();
    await screen.findByRole("checkbox", { name: /pierna entera/i });
    expect(screen.getByRole("button", { name: /reservar 24 h/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeDisabled();
  });

  it("sin pagar, 'Agendar' está apagado y 'Reservar 24 h' no, con el motivo y cuánto falta", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("checkbox", { name: /pierna entera/i }));

    expect(await screen.findByRole("button", { name: /reservar 24 h/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeDisabled();
    expect(screen.getByText(/40%/)).toBeInTheDocument();
    expect(screen.getByText(/24.000/)).toBeInTheDocument();
  });

  it("manda las zonas elegidas y el vencimiento de 24 h al reservar", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("checkbox", { name: /pierna entera/i }));
    await user.click(screen.getByRole("button", { name: /reservar 24 h/i }));

    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0]![0]).toMatchObject({
      customerId: "cu1",
      serviceId: "svc-ancla",
      customerPurchaseServiceId: "l1",
      zonas: ["z1"],
      status: "reserved",
      expiryMinutes: 1440,
    });
  });
});
