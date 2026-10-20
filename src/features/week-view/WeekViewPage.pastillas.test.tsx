import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const base = { status: "scheduled", reservationExpiresAt: null, activityId: null, trainingSessionId: null, durationMinutes: 60, serviceName: "Limpieza facial" };
const TURNOS = [
  { ...base, id: "a1", providerId: "p1", providerName: "Romina Suárez", customerName: "Sofía Herrera", appointmentStart: "2026-10-21T13:00:00.000Z", appointmentEnd: "2026-10-21T14:00:00.000Z" },
  { ...base, id: "pil", providerId: "p2", providerName: "Bea", customerName: "Alumna de Pilates", activityId: "act1", appointmentStart: "2026-10-21T15:00:00.000Z", appointmentEnd: "2026-10-21T16:00:00.000Z" },
  { ...base, id: "cap", providerId: "p2", providerName: "Bea", customerName: "Alumna de Capa", trainingSessionId: "t1", appointmentStart: "2026-10-22T15:00:00.000Z", appointmentEnd: "2026-10-22T16:00:00.000Z" },
];

vi.mock("../../api/agenda", async () => {
  const real = await vi.importActual<typeof import("../../api/agenda")>("../../api/agenda");
  return {
    ...real,
    useProviders: () => ({ data: [{ id: "p1", fullName: "Romina Suárez", specialties: null }, { id: "p2", fullName: "Bea", specialties: null }] }),
    useCompanyConfig: () => ({ data: { openHours: [] } }),
    useServices: () => ({ data: [] }),
    useProvidersByServices: () => ({ porServicio: new Map(), cargando: false }),
  };
});
const apiMock = vi.fn().mockResolvedValue(TURNOS);
vi.mock("../../api/client", () => ({ api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../nuevo-turno/NuevoTurnoModal", () => ({ NuevoTurnoModal: () => null }));

const { WeekViewPage } = await import("./WeekViewPage");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search = "?date=2026-10-21") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/semana${search}`]}>
        <Routes>
          <Route path="/semana" element={<><WeekViewPage /><Ubicacion /></>} />
          <Route path="/dia" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WeekViewPage — pastillas finas", () => {
  it("pide la semana en un solo pedido con from y to", async () => {
    apiMock.mockClear();
    montar();
    await screen.findAllByRole("button", { name: /Limpieza facial|Sofía/ });
    const pedidos = apiMock.mock.calls.map((c) => c[0] as string).filter((u) => u.includes("/api/agenda/appointments"));
    expect(pedidos).toEqual(["/api/agenda/appointments?from=2026-10-19&to=2026-10-24"]);
  });

  it("dibuja una pastilla por turno de servicio, sin actividades ni capacitaciones, del color de la prestadora", async () => {
    montar();
    const pastilla = await screen.findByRole("button", { name: /Sofía Herrera/ });
    expect(pastilla).toHaveStyle({ backgroundColor: "#fce7f3" });
    expect(screen.queryByRole("button", { name: /Pilates/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Capa/ })).not.toBeInTheDocument();
  });

  it("al pasar el mouse muestra la ficha con prestadora, clienta y servicio", async () => {
    montar();
    fireEvent.mouseEnter(await screen.findByRole("button", { name: /Sofía Herrera/ }));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Romina Suárez");
    expect(tip).toHaveTextContent("Sofía Herrera");
    expect(tip).toHaveTextContent("Limpieza facial");
  });

  it("el clic lleva al día con el turno a abrir", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /Sofía Herrera/ }));
    await waitFor(() => expect(screen.getByTestId("ubicacion").textContent).toMatch(/^\/dia\?/));
    const url = screen.getByTestId("ubicacion").textContent!;
    expect(url).toContain("date=2026-10-21");
    expect(url).toContain("turno=a1");
  });

  it("la semana vive en ?date= y se cambia con replace", async () => {
    montar();
    expect(screen.getByText(/19\/10\/2026 – 24\/10\/2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Semana siguiente"));
    await waitFor(() => expect(screen.getByTestId("ubicacion").textContent).toContain("date=2026-10-28"));
    expect(screen.getByText(/26\/10\/2026 – 31\/10\/2026/)).toBeInTheDocument();
  });
});
