import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { useAgendarLote, useBasePlanificador, useDisponibilidadEnLote } from "./planificador";
import type { ApiError } from "./client";

function fetchQueDevuelve(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const f = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: "",
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", f);
  return f;
}

function envolver(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

const nuevoQc = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

afterEach(() => vi.unstubAllGlobals());

describe("hooks del planificador", () => {
  it("useAgendarLote manda { turnos } y en un 409 expone error.indice", async () => {
    const f = fetchQueDevuelve({ error: "El horario ya no está libre", indice: 2 }, { ok: false, status: 409 });
    const { result } = renderHook(() => useAgendarLote(), { wrapper: envolver(nuevoQc()) });
    const turnos = [{ customerId: "cu1", serviceId: "s1", providerId: "p1", start: "2026-10-25T10:00:00.000Z" }];
    result.current.mutate({ turnos } as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    const [url, init] = f.mock.calls[0]!;
    expect(url).toMatch(/\/api\/agenda\/appointments\/lote$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ turnos });
    expect((result.current.error as ApiError).status).toBe(409);
    expect((result.current.error as ApiError).indice).toBe(2);
  });

  it("useAgendarLote invalida turnos, disponibilidad y ventas al terminar", async () => {
    fetchQueDevuelve({ turnos: [] }, { status: 201 });
    const qc = nuevoQc();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useAgendarLote(), { wrapper: envolver(qc) });
    result.current.mutate({ turnos: [] } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["appointments"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["appointments-range"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["availability"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["availability-month"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["ventas"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["consumible"] });
  });

  it("useDisponibilidadEnLote no pide nada con la lista vacía", async () => {
    const f = fetchQueDevuelve({ resultados: [] });
    const { result } = renderHook(() => useDisponibilidadEnLote([]), { wrapper: envolver(nuevoQc()) });
    await new Promise((r) => setTimeout(r, 20));
    expect(f).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useDisponibilidadEnLote manda las consultas en POST y devuelve resultados", async () => {
    const consultas = [{ serviceId: "s1", date: "2026-10-25", durationMinutes: 45 }];
    const f = fetchQueDevuelve({ resultados: [{ date: "2026-10-25", serviceId: "s1", durationMinutes: 45, slots: [] }] });
    const { result } = renderHook(() => useDisponibilidadEnLote(consultas), { wrapper: envolver(nuevoQc()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = f.mock.calls[0]!;
    expect(url).toMatch(/\/api\/agenda\/availability\/lote$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ consultas });
    expect(result.current.data?.resultados).toHaveLength(1);
  });

  it("useBasePlanificador pide la base de la compra por id", async () => {
    const f = fetchQueDevuelve({ compraId: "pu1" });
    const { result } = renderHook(() => useBasePlanificador("pu1"), { wrapper: envolver(nuevoQc()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f.mock.calls[0]![0]).toMatch(/\/api\/agenda\/planificador\/pu1$/);
    expect(result.current.data?.compraId).toBe("pu1");
  });

  it("useBasePlanificador no pide nada sin compra", async () => {
    const f = fetchQueDevuelve({});
    renderHook(() => useBasePlanificador(null), { wrapper: envolver(nuevoQc()) });
    await new Promise((r) => setTimeout(r, 20));
    expect(f).not.toHaveBeenCalled();
  });
});
