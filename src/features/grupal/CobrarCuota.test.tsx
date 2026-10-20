import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CobrarCuota } from "./CobrarCuota";

const cuotaBase = { billingCycleId: "c1", mes: "2026-10", cuota: 30000, pagado: 10000, debe: 20000, isPaid: false };
let fetchMock: ReturnType<typeof vi.fn>;
let cobroRespuesta: { ok: boolean; status: number; body: unknown };

beforeEach(() => {
  cobroRespuesta = { ok: true, status: 201, body: { cuota: { ...cuotaBase, pagado: 15000, debe: 15000 } } };
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const esCobro = init?.method === "POST";
    const r = esCobro ? cobroRespuesta : { ok: true, status: 200, body: cuotaBase };
    return { ok: r.ok, status: r.status, statusText: "x", json: async () => r.body };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function montar(over: Record<string, unknown> = {}) {
  const onCobrado = vi.fn();
  const onCerrar = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CobrarCuota subscriptionId="s1" mes="2026-10" descripcion="Yoga — octubre 2026 · Ana" onCobrado={onCobrado} onCerrar={onCerrar} {...over} />
    </QueryClientProvider>,
  );
  return { onCobrado, onCerrar };
}

const cobros = () => fetchMock.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method === "POST");

describe("CobrarCuota", () => {
  it("muestra cuota, pagado y Debe, y el monto arranca en el Debe", async () => {
    montar();
    expect(await screen.findByText(/^Debe$/)).toBeInTheDocument();
    expect(screen.getByText(/cuota de octubre/i).parentElement).toHaveTextContent("30.000");
    expect(screen.getByText("Pagado").parentElement).toHaveTextContent("10.000");
    expect(screen.getByText(/^Debe$/).parentElement).toHaveTextContent("20.000");
    expect(screen.getByLabelText("Monto")).toHaveValue(20000);
  });

  it("no deja cobrar más del Debe ni cero", async () => {
    const user = userEvent.setup();
    montar();
    const monto = await screen.findByLabelText("Monto");
    await user.clear(monto);
    await user.type(monto, "25000");
    expect(screen.getByText(/no se puede cobrar más de/i)).toHaveTextContent("20.000, que es lo que debe.");
    expect(screen.getByRole("button", { name: /^cobrar \$/i })).toBeDisabled();
    await user.clear(monto);
    expect(screen.getByRole("button", { name: /^cobrar \$/i })).toBeDisabled();
  });

  it("cobra y avisa el debe restante", async () => {
    const user = userEvent.setup();
    const { onCobrado } = montar();
    const monto = await screen.findByLabelText("Monto");
    await user.clear(monto);
    await user.type(monto, "5000");
    await user.click(screen.getByRole("button", { name: /^cobrar \$/i }));
    await waitFor(() => expect(onCobrado).toHaveBeenCalledWith(15000));
    const [url, init] = cobros()[0];
    expect(url).toContain("/api/training-subscriptions/s1/cobrar");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ mes: "2026-10", amount: 5000, method: "cash", wantsInvoice: false });
  });

  it("si la API falla muestra el mensaje y no avisa", async () => {
    const user = userEvent.setup();
    cobroRespuesta = { ok: false, status: 400, body: { error: "Caja cerrada" } };
    const { onCobrado } = montar();
    await user.click(await screen.findByRole("button", { name: /^cobrar \$/i }));
    expect(await screen.findByText(/caja cerrada/i)).toBeInTheDocument();
    expect(onCobrado).not.toHaveBeenCalled();
  });

  it("con debe 0 dice que está paga y sólo deja cerrar", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ ...cuotaBase, pagado: 30000, debe: 0, isPaid: true }) }));
    const { onCerrar } = montar();
    expect(await screen.findByText("La cuota de octubre ya está paga.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cobrar/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it("'Cobrar después' cierra sin cobrar", async () => {
    const user = userEvent.setup();
    const { onCerrar } = montar();
    await user.click(await screen.findByRole("button", { name: /cobrar después/i }));
    expect(onCerrar).toHaveBeenCalled();
    expect(cobros()).toHaveLength(0);
  });
});
