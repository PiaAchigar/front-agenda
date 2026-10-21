import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const base = {
  scheduleId: null, sessionId: null, activityType: "machine", sessionNumber: null, totalSessions: null,
  providerId: null, providerName: "Ana", machineId: null, machineName: null, location: null, attendedCount: 0,
  kind: "activity", capacity: 8, enrolledCount: 1, anotadas: [] as unknown[],
};
const clase = (id: string, date: string, extra = {}) => ({
  ...base, occurrenceId: id, subjectId: "a", name: `Clase ${id}`, date, startTime: "10:00", endTime: "11:00",
  startsAt: `${date}T13:00:00.000Z`, ...extra,
});
const anotada = (id: string, nombre: string, extra = {}) => ({
  appointmentId: id, customerId: id, nombre, prueba: false, debe: 0, subscriptionId: null, compraId: null, ...extra,
});

let CLASES: unknown[] = [];
const api = vi.fn(async (_url: string) => ({ success: true, data: CLASES }));
vi.mock("../../api/client", () => ({ api: (url: string) => api(url) }));

const { MesGrupal } = await import("./MesGrupal");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(anchor: string, search = "") {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/mes?date=${anchor}${search}`]}>
        <Routes>
          <Route path="/mes" element={<MesGrupal anchorDate={anchor} />} />
          <Route path="/dia" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MesGrupal", () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-07-01T12:00:00Z")); });
  afterAll(() => vi.useRealTimers());
  beforeEach(() => { api.mockClear(); CLASES = []; });

  it("un mes de 6 semanas pide un rango de 42 días y uno de 5 semanas, 35", async () => {
    montar("2026-08-10");
    await screen.findByTestId("dia-2026-08-10");
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/api/agenda/classes?from=2026-07-27&to=2026-09-06");
    api.mockClear();
    montar("2026-10-10");
    await vi.waitFor(() => expect(api).toHaveBeenCalledWith("/api/agenda/classes?from=2026-09-28&to=2026-11-01"));
  });

  it("un día con 3 clases muestra 3 puntos y '3 clases'; con 10, 8 puntos y '+2'", async () => {
    CLASES = [
      ...["1", "2", "3"].map((i) => clase(i, "2026-10-14")),
      ...Array.from({ length: 10 }, (_, i) => clase(`x${i}`, "2026-10-15")),
    ];
    montar("2026-10-10");
    await screen.findByText("3 clases");
    const d14 = within(screen.getByTestId("dia-2026-10-14"));
    expect(d14.getAllByTestId(/^punto-/)).toHaveLength(3);
    const d15 = within(screen.getByTestId("dia-2026-10-15"));
    expect(d15.getAllByTestId(/^punto-/)).toHaveLength(8);
    expect(d15.getByText("+2")).toBeInTheDocument();
    expect(d15.getByText("10 clases")).toBeInTheDocument();
  });

  it("sin filtros ningún día está en verde; con ?actividad=a sólo el que tiene una de a con lugar", async () => {
    CLASES = [
      clase("lugar", "2026-10-14"),
      clase("llena", "2026-10-15", { enrolledCount: 8 }),
      clase("otra", "2026-10-16", { subjectId: "b" }),
    ];
    montar("2026-10-10");
    await vi.waitFor(() => expect(within(screen.getByTestId("dia-2026-10-14")).getAllByTestId(/^punto-/)).toHaveLength(1));
    expect(document.querySelectorAll('[data-lugar="si"]')).toHaveLength(0);
  });

  it("con ?actividad=a el día con lugar queda verde y el de la clase llena no", async () => {
    CLASES = [
      clase("lugar", "2026-10-14"),
      clase("llena", "2026-10-15", { enrolledCount: 8 }),
      clase("otra", "2026-10-16", { subjectId: "b" }),
    ];
    montar("2026-10-10", "&actividad=a");
    await vi.waitFor(() => expect(screen.getByTestId("dia-2026-10-14")).toHaveAttribute("data-lugar", "si"));
    expect(screen.getByTestId("dia-2026-10-14").className).toContain("bg-emerald-100");
    expect(screen.getByTestId("dia-2026-10-15")).not.toHaveAttribute("data-lugar");
    expect(screen.getByTestId("dia-2026-10-16")).not.toHaveAttribute("data-lugar");
  });

  it("al pasar el mouse por un punto muestra la clase y sus anotadas", async () => {
    CLASES = [clase("pil", "2026-10-14", {
      name: "Pilates", enrolledCount: 2,
      anotadas: [anotada("1", "Lucía Pérez"), anotada("2", "Marta Gómez", { prueba: true, debe: 5000 })],
    })];
    montar("2026-10-10");
    const punto = await screen.findByTestId("punto-pil");
    expect(screen.queryByText("Lucía Pérez")).not.toBeInTheDocument();
    fireEvent.mouseEnter(punto);
    expect(screen.getByText("Pilates")).toBeInTheDocument();
    expect(screen.getByText("Lucía Pérez")).toBeInTheDocument();
    expect(screen.getByText("Marta Gómez")).toBeInTheDocument();
    expect(screen.getByText("Prueba")).toBeInTheDocument();
    expect(screen.getByText(/Debe \$/)).toBeInTheDocument();
    expect(screen.queryByTestId("ubicacion")).not.toBeInTheDocument();
  });

  it("tocar un día navega a /dia conservando la actividad", async () => {
    CLASES = [clase("lugar", "2026-10-14")];
    montar("2026-10-10", "&actividad=a");
    fireEvent.click(await screen.findByTestId("dia-2026-10-20"));
    const ruta = screen.getByTestId("ubicacion").textContent!;
    expect(ruta).toContain("/dia?");
    expect(ruta).toContain("date=2026-10-20");
    expect(ruta).toContain("actividad=a");
  });
});
