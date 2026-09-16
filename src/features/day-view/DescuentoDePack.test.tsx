import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Consumible } from "../../api/agenda";

const crear = vi.fn();
const consumible: { data: Consumible | undefined; isFetching: boolean } = {
  data: { tipo: "ninguna" },
  isFetching: false,
};

const SERVICIO = { id: "srv1", name: "Lifting de pestañas", estimatedDurationMinutes: 45 };
const CLIENTA = { id: "cli1", name: "Sofía Herrera", dni: "30111222", creditBalance: 0 };
const PROVEEDORA = { id: "prov1", name: "Gabi" };

vi.mock("../../api/agenda", () => ({
  useConsumible: () => consumible,
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomerSearch: () => ({ data: [CLIENTA], isFetching: false }),
  // Fiel al hook real: sin servicio elegido no hay prestadoras. Devolver
  // siempre la lista rompe el sincronizado del formulario, que sólo reasigna
  // la prestadora cuando la lista CAMBIA.
  useProvidersByService: (serviceId: string | null) => ({
    data: serviceId ? [PROVEEDORA] : [],
    isFetching: false,
  }),
  useServices: () => ({ data: [SERVICIO] }),
  useServicesByProvider: () => ({ data: [SERVICIO], isFetching: false }),
}));

const { NewAppointmentModal } = await import("./NewAppointmentModal");

/**
 * Busca por el texto COMPLETO del nodo.
 *
 * "Se descuenta de <strong>Lifting</strong>" viaja partido en dos nodos, y el
 * matcher normal de Testing Library compara nodo por nodo: nunca lo encuentra.
 */
const frase = (re: RegExp) => (_: string, el: Element | null) =>
  !!el && re.test(el.textContent ?? "") && !Array.from(el.children).some((h) => re.test(h.textContent ?? ""));

/** Abre la modal y deja elegida la clienta y el servicio. */
async function abrirConClientaYServicio(user: ReturnType<typeof userEvent.setup>) {
  render(<NewAppointmentModal open date="2027-01-20" prefill={null} onClose={() => {}} />);
  await user.type(screen.getByPlaceholderText(/nombre, dni/i), "Sofía");
  await user.click(await screen.findByText(/Sofía Herrera/));
  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[0]!, "srv1");
}

beforeEach(() => {
  crear.mockClear();
  consumible.data = { tipo: "ninguna" };
  consumible.isFetching = false;
});

describe("DescuentoDePack — sin nada a favor", () => {
  it("no muestra nada: sería ruido en todos los turnos normales", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    expect(screen.queryByText(frase(/se descuenta de/i))).not.toBeInTheDocument();
    expect(screen.queryByText(/de cuál se descuenta/i)).not.toBeInTheDocument();
  });
});

describe("DescuentoDePack — una sola compra", () => {
  beforeEach(() => {
    consumible.data = {
      tipo: "automatica",
      purchaseServiceId: "ses1",
      opcion: {
        purchaseId: "c1",
        descripcion: "Lifting de pestañas — pack de 3",
        disponibles: 2,
        venceEl: "2027-03-15T00:00:00.000Z",
        purchaseServiceId: "ses1",
      },
    };
  });

  it("la descuenta sola y avisa de cuál, sin pedir que elija", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    expect(await screen.findByText(frase(/se descuenta de/i))).toBeInTheDocument();
    expect(screen.getByText("Lifting de pestañas — pack de 3")).toBeInTheDocument();
    expect(screen.getByText(frase(/le quedan 2 servicios a agendar/i))).toBeInTheDocument();
    expect(screen.getByText(frase(/vence el 15\/03\/2027/i))).toBeInTheDocument();
    // No hay nada que elegir: no se ofrece un selector.
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("manda la sesión al crear el turno", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    await screen.findByText(frase(/se descuenta de/i));
    await user.click(screen.getByRole("button", { name: /confirmar turno/i }));

    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0]![0].customerPurchaseServiceId).toBe("ses1");
  });

  it("se puede soltar para cobrarlo aparte, y entonces no manda nada", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    await user.click(await screen.findByRole("button", { name: /no descontar/i }));

    expect(screen.getByText(/este turno se cobra aparte/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirmar turno/i }));
    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0]![0].customerPurchaseServiceId).toBeUndefined();
  });
});

describe("DescuentoDePack — un turno que ya está pago", () => {
  beforeEach(() => {
    consumible.data = {
      tipo: "automatica",
      purchaseServiceId: "ses1",
      opcion: {
        purchaseId: "c1",
        descripcion: "Lifting de pestañas — pack de 3",
        disponibles: 2,
        venceEl: null,
        purchaseServiceId: "ses1",
      },
    };
  });

  /**
   * La clienta ya pagó al comprar el pack. Dejar Precio y Seña a la vista
   * invita a cobrar dos veces lo mismo, que es el error caro (Pia,
   * 2026-09-16).
   */
  it("esconde Precio y Seña: no hay nada que cobrar acá", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    await screen.findByText(frase(/se descuenta de/i));

    expect(screen.queryByText("Precio")).not.toBeInTheDocument();
    expect(screen.queryByText(frase(/^Seña/))).not.toBeInTheDocument();
  });

  it("los devuelve si Laura decide cobrarlo aparte", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    await user.click(await screen.findByRole("button", { name: /no descontar/i }));

    expect(screen.getByText("Precio")).toBeInTheDocument();
    expect(screen.getByText(frase(/^Seña/))).toBeInTheDocument();
  });
});

describe("DescuentoDePack — varias compras", () => {
  beforeEach(() => {
    consumible.data = {
      tipo: "elige_laura",
      opciones: [
        {
          purchaseId: "c1",
          descripcion: "Lifting — pack de 3",
          disponibles: 1,
          venceEl: "2027-02-01T00:00:00.000Z",
          purchaseServiceId: "ses1",
        },
        {
          purchaseId: "c2",
          descripcion: "Combo Facial",
          disponibles: 4,
          venceEl: null,
          purchaseServiceId: "ses9",
        },
      ],
    };
  });

  it("pide que elija y no descuenta nada por su cuenta", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    expect(await screen.findByText(/de cuál se descuenta/i)).toBeInTheDocument();
    // Adivinar gastaría el pack equivocado: ninguna viene marcada salvo la de
    // "cobrarlo aparte".
    const marcados = screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked);
    expect(marcados).toHaveLength(1);
    expect(screen.getByLabelText(/no descontar/i)).toBeChecked();
  });

  it("manda la que Laura elige", async () => {
    const user = userEvent.setup();
    await abrirConClientaYServicio(user);
    await screen.findByText(/de cuál se descuenta/i);
    await user.click(screen.getByLabelText(/Combo Facial/));
    await user.click(screen.getByRole("button", { name: /confirmar turno/i }));

    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0]![0].customerPurchaseServiceId).toBe("ses9");
  });
});
