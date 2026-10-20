import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const base = { status: "scheduled", reservationExpiresAt: null, durationMinutes: 60 };
const TURNOS_DEL_21 = [
  { ...base, id: "a2", providerId: "p1", customerName: "Beatriz", serviceName: "Masaje", appointmentStart: "2026-10-21T17:30:00.000Z" },
  { ...base, id: "a1", providerId: "p1", customerName: "Ana", serviceName: "Rostro", appointmentStart: "2026-10-21T13:00:00.000Z" },
  { ...base, id: "b1", providerId: "p2", customerName: "Carla", serviceName: "Limpieza", appointmentStart: "2026-10-21T14:00:00.000Z" },
];

vi.mock("../../api/agenda", async () => {
  const real = await vi.importActual<typeof import("../../api/agenda")>("../../api/agenda");
  return {
    useDiasConLugar: real.useDiasConLugar,
    useDiasQueAtienden: real.useDiasQueAtienden,
    useProviders: () => ({ data: [{ id: "p1", fullName: "Romina", specialties: null }, { id: "p2", fullName: "Tamara", specialties: null }] }),
    useServices: () => ({ data: [{ id: "s1", name: "Limpieza facial" }] }),
    useProvidersByServices: (ids: string[]) => ({
      porServicio: new Map(ids.map((id) => [id, [{ id: "p1", fullName: "Romina" }, { id: "p2", fullName: "Tamara" }]])),
      cargando: false,
    }),
    useCompanyConfig: () => ({ data: { openHours: [] } }),
  };
});
vi.mock("../../api/client", () => ({
  api: vi.fn(async (url: string) => {
    if (url.startsWith("/api/agenda/appointments")) return url.includes("date=2026-10-21") ? TURNOS_DEL_21 : [];
    const sched = /providers\/schedule\?date=([\d-]+)/.exec(url);
    if (sched) {
      // Pasado (14), miércoles 21 trabaja Romina, jueves 22 trabaja Tamara; el 22 Romina trae ventanas vacías.
      if (sched[1] === "2026-10-14") return [{ providerId: "p1", windows: [{ start: 600, end: 900 }] }];
      if (sched[1] === "2026-10-21") return [{ providerId: "p1", windows: [{ start: 600, end: 900 }] }, { providerId: "p2", windows: [] }];
      if (sched[1] === "2026-10-22") return [{ providerId: "p1", windows: [] }, { providerId: "p2", windows: [{ start: 600, end: 900 }] }];
      return [];
    }
    if (url.includes("/month")) return { month: "2026-10", availableDays: ["2026-10-23"] };
    return [];
  }),
}));

const { MonthViewPage } = await import("./MonthViewPage");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/mes${search}`]}>
        <Routes>
          <Route path="/mes" element={<MonthViewPage />} />
          <Route path="/dia" element={<Ubicacion />} />
          <Route path="/semana" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const celda = (n: number) => screen.getAllByRole("button").find((b) => b.getAttribute("data-dia") === `2026-10-${String(n).padStart(2, "0")}`)!;
const verde = (n: number) => celda(n).className.includes("bg-emerald-100");

describe("MonthViewPage — filtros múltiples", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("con una prestadora y sin servicio, pinta de verde los días que trabaja (nunca los pasados)", async () => {
    montar("?prestadora=p1");
    await vi.waitFor(() => expect(verde(21)).toBe(true));
    expect(verde(22)).toBe(false); // Romina tiene ventanas vacías ese día
    expect(verde(14)).toBe(false); // trabajaba, pero ya pasó
    expect(verde(23)).toBe(false);
  });

  it("con varias prestadoras, verde si trabaja cualquiera de ellas", async () => {
    montar("?prestadora=p1&prestadora=p2");
    await vi.waitFor(() => expect(verde(21)).toBe(true));
    await vi.waitFor(() => expect(verde(22)).toBe(true));
    expect(verde(14)).toBe(false);
  });

  it("sin filtros no hay verde", async () => {
    montar("");
    await screen.findByText("Lun");
    expect(document.querySelector(".bg-emerald-100")).toBeNull();
  });

  it("con servicio elegido manda 'dónde hay lugar', no el horario de la prestadora", async () => {
    montar("?servicio=s1&prestadora=p1");
    await vi.waitFor(() => expect(verde(23)).toBe(true));
    expect(verde(21)).toBe(false);
  });

  it("pasar el mouse por el punto de una prestadora muestra sus turnos del día, uno por línea y por hora", async () => {
    montar("");
    const punto = await screen.findByTestId("punto-2026-10-21-p1");
    fireEvent.mouseEnter(punto);
    const ficha = await screen.findByRole("tooltip");
    expect(within(ficha).getByText("Romina")).toBeInTheDocument();
    const lineas = within(ficha).getAllByTestId("linea-de-turno").map((l) => l.textContent);
    expect(lineas).toEqual(["10:00 · Ana · Rostro", "14:30 · Beatriz · Masaje"]);
    fireEvent.mouseLeave(punto);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("la ficha de una prestadora no trae los turnos de otra", async () => {
    montar("");
    fireEvent.mouseEnter(await screen.findByTestId("punto-2026-10-21-p2"));
    const ficha = await screen.findByRole("tooltip");
    expect(within(ficha).getAllByTestId("linea-de-turno").map((l) => l.textContent)).toEqual(["11:00 · Carla · Limpieza"]);
  });

  it("con el mouse, clic en el punto sigue yendo al día", async () => {
    montar("?prestadora=p1");
    fireEvent.click(await screen.findByTestId("punto-2026-10-21-p1"));
    const url = screen.getByTestId("ubicacion").textContent!;
    expect(url).toMatch(/^\/dia\?/);
    expect(url).toContain("date=2026-10-21");
    expect(url).toContain("prestadora=p1");
  });

  it("con el dedo, el primer toque en el punto muestra la ficha y NO va al día; el segundo sí", async () => {
    montar("");
    const punto = await screen.findByTestId("punto-2026-10-21-p1");
    fireEvent.pointerDown(punto, { pointerType: "touch" });
    fireEvent.click(punto);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    expect(screen.queryByTestId("ubicacion")).not.toBeInTheDocument();
    fireEvent.pointerDown(punto, { pointerType: "touch" });
    fireEvent.click(punto);
    expect(screen.getByTestId("ubicacion").textContent).toContain("date=2026-10-21");
  });

  it("tocar un día verde por horario lleva al día, con todos los filtros", async () => {
    montar("?prestadora=p1&prestadora=p2");
    await vi.waitFor(() => expect(verde(21)).toBe(true));
    fireEvent.click(celda(21));
    const u = new URL("http://x" + screen.getByTestId("ubicacion").textContent!);
    expect(u.pathname).toBe("/dia");
    expect(u.searchParams.getAll("prestadora")).toEqual(["p1", "p2"]);
  });
});
