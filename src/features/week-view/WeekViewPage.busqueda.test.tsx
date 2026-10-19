import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const TURNOS = [
  { id: "a1", providerId: "p1", providerName: "Ana", customerName: "Clienta de Ana", serviceName: "Rostro", status: "scheduled", reservationExpiresAt: null, appointmentStart: "2026-10-19T13:00:00.000Z", appointmentEnd: "2026-10-19T14:00:00.000Z", durationMinutes: 60 },
  { id: "b1", providerId: "p2", providerName: "Bea", customerName: "Clienta de Bea", serviceName: "Masaje", status: "scheduled", reservationExpiresAt: null, appointmentStart: "2026-10-19T15:00:00.000Z", appointmentEnd: "2026-10-19T16:00:00.000Z", durationMinutes: 60 },
];

vi.mock("../../api/agenda", async () => ({
  // El hook real del rango, sobre el `api` mockeado.
  useAppointmentsRange: (await vi.importActual<typeof import("../../api/agenda")>("../../api/agenda")).useAppointmentsRange,
  useProviders: () => ({ data: [{ id: "p1", fullName: "Ana", specialties: null }, { id: "p2", fullName: "Bea", specialties: null }] }),
  useServices: () => ({ data: [] }),
  useProvidersByService: (id: string | null) => ({ data: id ? [{ id: "p2", fullName: "Bea", specialties: null }] : undefined }),
  useCompanyConfig: () => ({ data: { openHours: [] } }),
}));
vi.mock("../../api/client", () => ({
  // La semana entera en un solo pedido.
  api: vi.fn().mockResolvedValue(TURNOS),
}));
vi.mock("../day-view/NewAppointmentModal", () => ({ NewAppointmentModal: () => null }));

const { WeekViewPage } = await import("./WeekViewPage");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/semana${search}`]}>
        <Routes>
          <Route path="/semana" element={<WeekViewPage />} />
          <Route path="/dia" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WeekViewPage — la búsqueda", () => {
  it("sin búsqueda están los turnos de todas", async () => {
    montar("?date=2026-10-19");
    expect((await screen.findAllByText("Clienta de Ana")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clienta de Bea").length).toBeGreaterThan(0);
  });

  it("?prestadora=p1 deja sólo sus turnos", async () => {
    montar("?date=2026-10-19&prestadora=p1");
    expect((await screen.findAllByText("Clienta de Ana")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Clienta de Bea")).not.toBeInTheDocument();
  });

  it("?servicio=s1 deja sólo los turnos de las prestadoras de ese servicio", async () => {
    montar("?date=2026-10-19&servicio=s1");
    expect((await screen.findAllByText("Clienta de Bea")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Clienta de Ana")).not.toBeInTheDocument();
  });

  it("tocar un día lleva al día conservando la búsqueda", async () => {
    montar("?date=2026-10-19&prestadora=p1&con=c9");
    fireEvent.click(await screen.findByText("Lun"));
    const url = screen.getByTestId("ubicacion").textContent!;
    expect(url).toMatch(/^\/dia\?/);
    expect(url).toContain("date=");
    expect(url).toContain("prestadora=p1");
    expect(url).toContain("con=c9");
  });
});
