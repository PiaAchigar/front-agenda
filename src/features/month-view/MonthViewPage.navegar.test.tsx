import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/agenda", async () => {
  const real = await vi.importActual<typeof import("../../api/agenda")>("../../api/agenda");
  return {
    useDiasConLugar: real.useDiasConLugar,
    useProviders: () => ({ data: [] }),
    useServices: () => ({ data: [] }),
    useProvidersByService: () => ({ data: [], isLoading: false }),
    useCompanyConfig: () => ({ data: { openHours: [] } }),
  };
});
vi.mock("../../api/client", () => ({ api: vi.fn(async () => []) }));

const { MonthViewPage } = await import("./MonthViewPage");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

describe("MonthViewPage — paginar el mes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("paginar escribe el mes en la URL (reemplazando), así recargar o pasar a Semana conserva el mes", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/mes?date=2026-10-16&servicio=s1"]}>
          <Ubicacion />
          <Routes><Route path="/mes" element={<MonthViewPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText("Lun");
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    const url = screen.getByTestId("ubicacion").textContent!;
    expect(url).toContain("date=2026-11-01");
    expect(url).toContain("servicio=s1");
  });
});
