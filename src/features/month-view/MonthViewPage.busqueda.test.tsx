import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const base = { status: "scheduled", reservationExpiresAt: null, customerName: "X", serviceName: "S" };
const TURNOS = [
  { ...base, id: "a1", providerId: "p1" },
  { ...base, id: "a2", providerId: "p1" },
  { ...base, id: "b1", providerId: "p2" },
];

vi.mock("../../api/agenda", async () => ({
  useDiasConLugar: (await vi.importActual<typeof import("../../api/agenda")>("../../api/agenda")).useDiasConLugar,
  useProviders: () => ({ data: [{ id: "p1", fullName: "Ana", specialties: null }, { id: "p2", fullName: "Bea", specialties: null }] }),
  useServices: () => ({ data: [] }),
  useProvidersByService: (id: string | null) => ({ data: id ? [{ id: "p2", fullName: "Bea", specialties: null }] : undefined }),
  useCompanyConfig: () => ({ data: { openHours: [] } }),
}));
vi.mock("../../api/client", () => ({ api: vi.fn().mockResolvedValue(TURNOS) }));

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
          <Route path="/dia" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MonthViewPage — la búsqueda", () => {
  it("sin búsqueda cuenta los turnos de todas", async () => {
    montar("");
    expect((await screen.findAllByText("3 turnos")).length).toBeGreaterThan(0);
  });

  it("?prestadora=p1 cuenta sólo sus turnos", async () => {
    montar("?prestadora=p1");
    expect((await screen.findAllByText("2 turnos")).length).toBeGreaterThan(0);
    expect(screen.queryByText("3 turnos")).not.toBeInTheDocument();
  });

  it("?servicio=s1 cuenta sólo los de las prestadoras de ese servicio", async () => {
    montar("?servicio=s1");
    expect((await screen.findAllByText("1 turno")).length).toBeGreaterThan(0);
    expect(screen.queryByText("3 turnos")).not.toBeInTheDocument();
  });

  it("tocar un día lleva al día conservando la búsqueda", async () => {
    montar("?servicio=s1&con=p2");
    fireEvent.click((await screen.findAllByText("1 turno"))[0]!);
    const url = screen.getByTestId("ubicacion").textContent!;
    expect(url).toMatch(/^\/dia\?/);
    expect(url).toContain("date=");
    expect(url).toContain("servicio=s1");
    expect(url).toContain("con=p2");
  });
});
