import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosParaAgendar } from "../../api/types";

const crear = vi.fn();
const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", creditBalance: 0 };
const PROVEEDORA = { id: "prov1", fullName: "Gabi", specialties: null };

const datosDepilacion: DatosParaAgendar = {
  nombreDelPack: "Cuerpo Full",
  sesion: 1,
  sesionesTotales: 3,
  presupuestoMinutos: 60,
  zonasDeRegalo: 0,
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

/**
 * El resultado de `useParaAgendar`, mutable: los tests de la ronda 3 necesitan
 * un caso de ERROR (el 404 de una línea que otra pestaña acaba de tomar) y la
 * respuesta EN HOMBRE, que sólo llega después de que Laura toca el selector.
 */
let respuestaParaAgendar: {
  data?: DatosParaAgendar;
  isFetching: boolean;
  error?: Error | null;
} = { data: datosDepilacion, isFetching: false, error: null };

/** Con qué `sexo` se llamó a `useParaAgendar` en el último render. */
let sexoPedido: string | undefined;

vi.mock("../../api/agenda", () => ({
  useComboPendientes: () => ({ data: undefined, isSuccess: false }),
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomer: () => ({ data: CLIENTA }),
  useCustomerSearch: () => ({ data: [], isFetching: false }),
  useParaAgendar: (_id: string | null, sexo?: string) => {
    sexoPedido = sexo;
    return respuestaParaAgendar;
  },
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
  respuestaParaAgendar = { data: datosDepilacion, isFetching: false, error: null };
  sexoPedido = undefined;
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

/**
 * Ronda de arreglos 3. Tres agujeros de esta pantalla, todos en el mismo par
 * de archivos:
 *
 * - **Critical 2**: el selector de sexo no viajaba en el POST, así que el
 *   servidor recalculaba la duración con el sexo de la ficha. La pantalla
 *   decía 15 min y la base guardaba 12.
 * - **Diferido #7**: al cambiar de sexo DESPUÉS de tildar, el presupuesto
 *   nuevo podía quedar por debajo de lo elegido y el motivo mostraba un
 *   número negativo ("No entra en los -3 min que quedan").
 * - **Minor 5**: el error de `useParaAgendar` no se renderizaba en ningún
 *   lado — un 404 dejaba el modal en blanco, sin mensaje y con los botones
 *   apagados.
 */
describe("NewAppointmentModal — depilación, ronda de arreglos 3", () => {
  const datosHombre: DatosParaAgendar = {
    ...datosDepilacion,
    sexo: "hombre",
    presupuestoMinutos: 60,
    zonas: [
      { id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 10, esDeRegalo: false, disponible: true, motivo: null },
      { id: "z2", nombre: "Axila", categoria: "chica", minutos: 5, esDeRegalo: false, disponible: true, motivo: null },
    ],
    puerta: { puedeAgendar: true, puedeReservar: true, motivo: null, faltaCobrar: 0 },
  };

  it("el sexo elegido viaja en el POST, no se queda en la pantalla", async () => {
    const user = userEvent.setup();
    respuestaParaAgendar = { data: datosHombre, isFetching: false, error: null };
    abrir();

    await user.selectOptions(await screen.findByRole("combobox", { name: /sexo/i }), "hombre");
    // El menú se vuelve a pedir con el sexo pisado…
    expect(sexoPedido).toBe("hombre");

    await user.click(await screen.findByRole("checkbox", { name: /pierna entera/i }));
    await user.click(screen.getByRole("button", { name: /^agendar$/i }));

    await waitFor(() => expect(crear).toHaveBeenCalled());
    // …y también viaja al crear el turno: el servidor recalcula, pero con el
    // MISMO sexo.
    expect(crear.mock.calls[0]![0]).toMatchObject({ sexo: "hombre", zonas: ["z1"] });
  });

  it("sin tocar el selector no manda sexo: manda el de la ficha", async () => {
    const user = userEvent.setup();
    respuestaParaAgendar = {
      data: { ...datosDepilacion, puerta: { puedeAgendar: true, puedeReservar: true, motivo: null, faltaCobrar: 0 } },
      isFetching: false,
      error: null,
    };
    abrir();
    await user.click(await screen.findByRole("checkbox", { name: /pierna entera/i }));
    await user.click(screen.getByRole("button", { name: /^agendar$/i }));

    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0]![0].sexo).toBeUndefined();
  });

  it("cambiar de sexo limpia las zonas tildadas: los minutos de cada zona son otros", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("checkbox", { name: /pierna entera/i }));
    expect(screen.getByText(/9 de 60 min/i)).toBeInTheDocument();

    respuestaParaAgendar = { data: datosHombre, isFetching: false, error: null };
    await user.selectOptions(screen.getByRole("combobox", { name: /sexo/i }), "hombre");

    expect(await screen.findByText(/0 de 60 min/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /pierna entera/i })).not.toBeChecked();
  });

  it("si el menú no se puede cargar, lo dice en vez de quedar en blanco", async () => {
    respuestaParaAgendar = {
      data: undefined,
      isFetching: false,
      error: new Error("Servicio de depilación not found"),
    };
    abrir();

    expect(await screen.findByText(/Servicio de depilación not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reservar 24 h/i })).toBeDisabled();
  });
});
