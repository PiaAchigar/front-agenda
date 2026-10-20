import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { cobrarCompra, cotizarVenta, useCobrarCompra, venderCompra } from "./ventas";

function fetchQueDevuelve(body: unknown) {
  const f = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe("rutas de venta — las mismas que usa el CRM", () => {
  it("cotizar va a POST /api/crm/purchases/quote con el pedido tal cual", async () => {
    const f = fetchQueDevuelve({ finalAmount: 1 });
    await cotizarVenta({ origen: "servicio", id: "s1", sessions: 2, promotionId: null, customerId: "cu1" });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toMatch(/\/api\/crm\/purchases\/quote$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ origen: "servicio", id: "s1", sessions: 2, promotionId: null, customerId: "cu1" });
  });

  it("vender va a POST /api/crm/purchases", async () => {
    const f = fetchQueDevuelve({ id: "pu1" });
    const r = await venderCompra({
      description: "X", sessionsTotal: 1, baseAmount: 1, discountedAmount: 1, finalAmount: 1,
      promotionId: null, expiresAt: null, comboId: null, depilationComboId: null, serviceId: "s1",
      trainingId: null, customerId: "cu1", usarSaldo: 0,
    });
    expect(f.mock.calls[0]![0]).toMatch(/\/api\/crm\/purchases$/);
    expect(r.id).toBe("pu1");
  });

  it("cobrar va a POST /api/crm/purchases/:id/checkout", async () => {
    const f = fetchQueDevuelve({ pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false });
    await cobrarCompra("pu1", { amount: 100, method: "cash", wantsInvoice: false });
    expect(f.mock.calls[0]![0]).toMatch(/\/api\/crm\/purchases\/pu1\/checkout$/);
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ amount: 100, method: "cash", wantsInvoice: false });
  });
});

describe("cobrar relee lo que la agenda muestra", () => {
  it("useCobrarCompra invalida los turnos (el 'Debe $X' no queda viejo) y la puerta de depilación", async () => {
    fetchQueDevuelve({ pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false });
    const qc = new QueryClient();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    const { result } = renderHook(() => useCobrarCompra(), { wrapper });
    result.current.mutate({ id: "pu1", amount: 100, method: "cash", wantsInvoice: false });
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["para-agendar"] }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["appointments"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["appointments-range"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["classes"] });
  });
});
