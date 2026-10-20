import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PROVEEDORAS = [{ id: "p1", fullName: "Romina", specialties: null }, { id: "p2", fullName: "Tamara", specialties: null }];
let delServicio: typeof PROVEEDORAS = PROVEEDORAS;
let huecosDelMiercoles = true;
let fallar = false;
let slotsCada15 = false;

const TURNO = { id: "a1", providerId: "p1", providerName: "Romina", customerName: "Clienta tomada", serviceName: "Rostro", status: "scheduled", reservationExpiresAt: null, appointmentStart: "2026-10-21T13:00:00.000Z", appointmentEnd: "2026-10-21T14:00:00.000Z", durationMinutes: 60 };

vi.mock("../../api/agenda", async () => {
  const real = await vi.importActual<typeof import("../../api/agenda")>("../../api/agenda");
  return {
    useAppointmentsRange: real.useAppointmentsRange,
    useHuecosDeLaSemana: real.useHuecosDeLaSemana,
    useProviders: () => ({ data: PROVEEDORAS }),
    useServices: () => ({ data: [{ id: "s1", name: "Limpieza facial" }] }),
    useProvidersByService: () => ({ data: delServicio, isLoading: false }),
    useCompanyConfig: () => ({ data: { openHours: [] } }),
  };
});
vi.mock("../../api/client", () => ({
  api: vi.fn(async (url: string) => {
    if (url.startsWith("/api/agenda/appointments")) return [TURNO];
    if (fallar) throw new Error("boom");
    const m = /availability\/s1\?date=([\d-]+)/.exec(url);
    if (m && m[1] === "2026-10-21" && huecosDelMiercoles) {
      return {
        date: m[1], serviceId: "s1", durationMinutes: 60,
        slots: [...(slotsCada15 ? [{ start: "10:45", end: "11:45", options: [{ providerId: "p1", providerName: "Romina", machineId: null }] }] : []), { start: "10:30", end: "11:30", options: [
          { providerId: "p1", providerName: "Romina", machineId: null },
          { providerId: "p2", providerName: "Tamara", machineId: null },
        ] }],
      };
    }
    return { date: "x", serviceId: "s1", durationMinutes: 60, slots: [] };
  }),
}));
const abrirNuevo = vi.fn();
vi.mock("../nuevo-turno/NuevoTurnoModal", () => ({
  NuevoTurnoModal: (p: { date: string; prefill: unknown }) => {
    abrirNuevo(p.date, p.prefill);
    return <div data-testid="modal-nuevo" />;
  },
}));

const { WeekViewPage } = await import("./WeekViewPage");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/semana${search}`]}>
        <Routes>
          <Route path="/semana" element={<WeekViewPage />} />
          <Route path="/mes" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WeekViewPage — dónde hay lugar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
    delServicio = PROVEEDORAS;
    huecosDelMiercoles = true;
    fallar = false;
    slotsCada15 = false;
    abrirNuevo.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("dibuja 'La hacen:' y un botón por hueco libre, con los turnos apagados", async () => {
    montar("?date=2026-10-19&servicio=s1");
    expect(await screen.findByRole("button", { name: "10:30 Romina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:30 Tamara" })).toBeInTheDocument();
    expect(screen.getByText("La hacen:")).toBeInTheDocument();
    expect(screen.getByTestId("turnos-2026-10-21")).toHaveStyle({ opacity: "0.35" });
  });

  it("los huecos de la API van de a 15 min: cada caja mide 15 min y no se pisa con la siguiente", async () => {
    slotsCada15 = true;
    montar("?date=2026-10-19&servicio=s1");
    const a = await screen.findByRole("button", { name: "10:30 Romina" });
    const b = await screen.findByRole("button", { name: "10:45 Romina" });
    const alto = (el: HTMLElement) => parseFloat(el.style.height);
    const top = (el: HTMLElement) => parseFloat(el.style.top);
    expect(top(b) - top(a)).toBe(30); // 15 min a 2 px por minuto
    expect(alto(a)).toBeLessThanOrEqual(top(b) - top(a));
  });

  it("tocar un hueco abre Nuevo turno con servicio, prestadora y hora", async () => {
    montar("?date=2026-10-19&servicio=s1");
    fireEvent.click(await screen.findByRole("button", { name: "10:30 Romina" }));
    await screen.findByTestId("modal-nuevo");
    expect(abrirNuevo).toHaveBeenLastCalledWith(
      "2026-10-21",
      expect.objectContaining({ serviceId: "s1", providerId: "p1", minutes: 630 }),
    );
  });

  it("con ?con=p1 sólo los huecos de Romina", async () => {
    montar("?date=2026-10-19&servicio=s1&con=p1");
    await screen.findByRole("button", { name: "10:30 Romina" });
    expect(screen.queryByRole("button", { name: "10:30 Tamara" })).not.toBeInTheDocument();
  });

  it("sin huecos avisa y ofrece ver el mes", async () => {
    huecosDelMiercoles = false;
    montar("?date=2026-10-19&servicio=s1");
    expect(await screen.findByText("No hay lugar para Limpieza facial esta semana.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver el mes" }));
    const url = screen.getByTestId("ubicacion").textContent!;
    expect(url).toMatch(/^\/mes\?/);
    expect(url).toContain("servicio=s1");
  });

  it("si falla la consulta lo avisa y no dice que no hay lugar", async () => {
    fallar = true;
    // La API no devuelve turnos de la semana si todo falla; alcanza con las disponibilidades.
    montar("?date=2026-10-19&servicio=s1");
    expect(await screen.findByText("No se pudo consultar la disponibilidad. Probá de nuevo.")).toBeInTheDocument();
    expect(screen.queryByText(/No hay lugar para/)).not.toBeInTheDocument();
  });

  it("un servicio sin prestadoras avisa que nadie lo tiene", async () => {
    delServicio = [];
    montar("?date=2026-10-19&servicio=s1");
    expect(await screen.findByText("Nadie tiene asignado este servicio todavía.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/No hay lugar para/)).not.toBeInTheDocument());
  });
});
