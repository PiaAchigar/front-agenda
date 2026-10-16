import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let errorDeCobro: Error | null = null;
const cobrar = vi.fn((_input: unknown, opts?: { onSuccess?: (r: unknown) => void }) => {
  opts?.onSuccess?.({ pendiente: 100000, minimo: 0, sugerido: 100000, faltaElMinimo: false });
});

vi.mock("../../api/ventas", () => ({
  useCobrarCompra: () => ({ mutate: cobrar, isPending: false, error: errorDeCobro }),
}));

const { CobrarPaso } = await import("./CobrarPaso");

function montar(over: Partial<Parameters<typeof CobrarPaso>[0]> = {}) {
  const onCobrado = vi.fn();
  const onDespues = vi.fn();
  render(
    <CobrarPaso compraId="pu1" descripcion="Pack Piernas x6" pendiente={166000} minimo={66400}
      onCobrado={onCobrado} onDespues={onDespues} {...over} />,
  );
  return { onCobrado, onDespues };
}

beforeEach(() => {
  cobrar.mockClear();
  errorDeCobro = null;
});

describe("CobrarPaso (agenda) — copia del CRM", () => {
  it("arranca con todo y muestra el mínimo que manda la API", () => {
    montar();
    expect(screen.getByLabelText("Monto")).toHaveValue(166000);
    expect(screen.getByText(/mínimo del primer pago/i)).toHaveTextContent("66.400");
  });

  it("no deja cobrar menos del mínimo", async () => {
    const user = userEvent.setup();
    montar();
    await user.clear(screen.getByLabelText("Monto"));
    await user.type(screen.getByLabelText("Monto"), "1000");
    expect(screen.getByRole("button", { name: /^cobrar \$/i })).toBeDisabled();
  });

  it("cobra con el checkout y avisa cuánto quedó pendiente", async () => {
    const user = userEvent.setup();
    const { onCobrado } = montar();
    await user.click(screen.getByRole("button", { name: /seña 40%/i }));
    await user.click(screen.getByRole("button", { name: /^cobrar \$/i }));
    expect(cobrar).toHaveBeenCalledWith(
      { id: "pu1", amount: 66400, method: "cash", wantsInvoice: false },
      expect.anything(),
    );
    expect(onCobrado).toHaveBeenCalledWith(100000);
  });

  it("'Cobrar después' no cobra nada", async () => {
    const user = userEvent.setup();
    const { onDespues } = montar();
    await user.click(screen.getByRole("button", { name: /cobrar después/i }));
    expect(cobrar).not.toHaveBeenCalled();
    expect(onDespues).toHaveBeenCalled();
  });

  it("si el cobro falla, dice que la venta quedó hecha", () => {
    errorDeCobro = new Error("ARCA no responde");
    montar();
    expect(screen.getByText(/la venta quedó hecha, el cobro no: arca no responde/i)).toBeInTheDocument();
  });
});
