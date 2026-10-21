import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DarDeBajaModal } from "./DarDeBajaModal";

const apiMock = vi.fn();
vi.mock("../../api/client", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

type Cuenta = Record<string, unknown>;
let cuenta: Cuenta;
const noEmpezo: Cuenta = {
  compraId: "k1", empezo: false, precio: 100000, pagado: 40000, encuentrosTotales: 3, encuentrosPasados: 0,
  vino: 0, falto: 0, corresponde: 0, sugerido: { saldoAFavor: 40000, debe: 0 },
};
// El ejemplo de Pia: 3 encuentros, pagó el 40%, vino a 1, faltó a 1.
const empezoDebe: Cuenta = {
  compraId: "k1", empezo: true, precio: 100000, pagado: 40000, encuentrosTotales: 3, encuentrosPasados: 2,
  vino: 1, falto: 1, corresponde: 66667, sugerido: { saldoAFavor: 0, debe: 26667 },
};
const empezoAFavor: Cuenta = { ...empezoDebe, pagado: 100000, sugerido: { saldoAFavor: 33333, debe: 0 } };

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? { success: true, data: { encuentrosCancelados: 1, saldoAcreditado: 0, debe: 0 } }
      : { success: true, data: cuenta },
  );
});

function montar() {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DarDeBajaModal trainingId="t1" customerId="cu1" nombre="Ana" onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, modal: () => screen.getByRole("dialog", { name: "Dar de baja de la capacitación" }) };
}
const post = () => {
  const llamada = apiMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
  return llamada ? { url: llamada[0], body: JSON.parse((llamada[1] as RequestInit).body as string) } : null;
};

describe("DarDeBajaModal", () => {
  it("antes de empezar: cancela la compra y lo pagado queda a favor", async () => {
    cuenta = noEmpezo;
    const { onClose, modal } = montar();
    expect(await within(modal()).findByText(/Todavía no empezó/)).toBeInTheDocument();
    expect(within(modal()).getByText(/\$40\.000 que pagó quedan como saldo a favor/)).toBeInTheDocument();
    await userEvent.click(within(modal()).getByRole("button", { name: "Dar de baja" }));
    expect(post()).toEqual({ url: "/api/agenda/classes/baja-de-capacitacion", body: { trainingId: "t1", customerId: "cu1" } });
    expect(onClose).toHaveBeenCalled();
  });

  it("antes de empezar y sin pagos: dice que no queda debiendo nada", async () => {
    cuenta = { ...noEmpezo, pagado: 0, sugerido: { saldoAFavor: 0, debe: 0 } };
    const { modal } = montar();
    expect(await within(modal()).findByText(/No queda debiendo nada/)).toBeInTheDocument();
  });

  it("ya empezada y pagó de menos: muestra la cuenta y sugiere lo que queda debiendo", async () => {
    cuenta = empezoDebe;
    const { modal } = montar();
    const m = within(modal());
    expect(await m.findByText("3 · ya pasaron 2 (vino a 1, faltó a 1)")).toBeInTheDocument();
    expect(m.getByText("$66.667")).toBeInTheDocument();
    expect(m.getByLabelText("Queda debiendo")).toHaveValue(26667);
    await userEvent.clear(m.getByLabelText("Queda debiendo"));
    await userEvent.type(m.getByLabelText("Queda debiendo"), "20000");
    await userEvent.click(m.getByRole("button", { name: "Dar de baja" }));
    expect(post()!.body).toEqual({ trainingId: "t1", customerId: "cu1", debe: 20000 });
  });

  it("ya empezada y pagó de más: sugiere saldo a favor", async () => {
    cuenta = empezoAFavor;
    const { modal } = montar();
    const m = within(modal());
    expect(await m.findByLabelText("Saldo a favor")).toHaveValue(33333);
    await userEvent.click(m.getByRole("button", { name: "Dar de baja" }));
    expect(post()!.body).toEqual({ trainingId: "t1", customerId: "cu1", saldoAFavor: 33333 });
  });

  it("no deja pasar un monto fuera de rango", async () => {
    cuenta = empezoDebe;
    const { modal } = montar();
    const m = within(modal());
    await userEvent.clear(await m.findByLabelText("Queda debiendo"));
    await userEvent.type(m.getByLabelText("Queda debiendo"), "70000");
    expect(m.getByText("Va de $0 a $60.000.")).toBeInTheDocument();
    expect(m.getByRole("button", { name: "Dar de baja" })).toBeDisabled();
  });

  it("si la API falla, lo muestra y no cierra", async () => {
    cuenta = noEmpezo;
    apiMock.mockImplementation(async (_u: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("No compró esta capacitación");
      return { success: true, data: cuenta };
    });
    const { onClose, modal } = montar();
    await userEvent.click(await within(modal()).findByRole("button", { name: "Dar de baja" }));
    expect(await within(modal()).findByText("No compró esta capacitación")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
