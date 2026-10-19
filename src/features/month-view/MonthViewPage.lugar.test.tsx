import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/agenda", async () => {
  const real = await vi.importActual<typeof import("../../api/agenda")>("../../api/agenda");
  return {
    useDiasConLugar: real.useDiasConLugar,
    useProviders: () => ({ data: [{ id: "p1", fullName: "Romina", specialties: null }, { id: "p2", fullName: "Tamara", specialties: null }] }),
    useServices: () => ({ data: [{ id: "s1", name: "Limpieza facial" }] }),
    useProvidersByService: () => ({ data: [{ id: "p1", fullName: "Romina" }, { id: "p2", fullName: "Tamara" }], isLoading: false }),
    useCompanyConfig: () => ({ data: { openHours: [] } }),
  };
});
vi.mock("../../api/client", () => ({
  api: vi.fn(async (url: string) => {
    if (url.startsWith("/api/agenda/appointments")) return [];
    if (url.includes("providerId=p1")) return { month: "2026-10", availableDays: ["2026-10-22", "2026-10-05"] };
    return { month: "2026-10", availableDays: ["2026-10-23"] };
  }),
}));

const { MonthViewPage } = await import("./MonthViewPage");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/mes${search}`]}>
        <Routes>
          <Route path="/mes" element={<MonthViewPage />} />
          <Route path="/semana" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const celda = (n: number) => screen.getAllByRole("button").find((b) => b.getAttribute("data-dia") === `2026-10-${String(n).padStart(2, "0")}`)!;

describe("MonthViewPage — dónde hay lugar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("marca los días con lugar de cualquiera de las prestadoras, nunca los pasados", async () => {
    montar("?servicio=s1");
    await screen.findByText("La hacen:");
    await vi.waitFor(() => expect(celda(22)).toHaveAttribute("data-lugar", "si"));
    expect(celda(23)).toHaveAttribute("data-lugar", "si");
    expect(celda(5)).not.toHaveAttribute("data-lugar", "si");
    expect(celda(21)).not.toHaveAttribute("data-lugar", "si");
  });

  it("tocar un día con lugar lleva a la semana de ese día", async () => {
    montar("?servicio=s1");
    await screen.findByText("La hacen:");
    await vi.waitFor(() => expect(celda(22)).toHaveAttribute("data-lugar", "si"));
    fireEvent.click(celda(22));
    const url = screen.getByTestId("ubicacion").textContent!;
    expect(url).toMatch(/^\/semana\?/);
    expect(url).toContain("date=2026-10-22");
    expect(url).toContain("servicio=s1");
  });

  it("sin servicio buscado no marca nada", async () => {
    montar("");
    await screen.findByText("Lun");
    expect(document.querySelector('[data-lugar="si"]')).toBeNull();
  });
});
