import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const base = {
  scheduleId: null, sessionId: null, activityType: "machine", sessionNumber: null, totalSessions: null,
  providerId: null, providerName: "Ana", machineId: null, location: null, attendedCount: 0, kind: "activity",
};
const anotada = (id: string, nombre: string, extra = {}) => ({
  appointmentId: id, customerId: id, nombre, prueba: false, debe: 0, subscriptionId: null, compraId: null, ...extra,
});
const CLASES = [
  { ...base, occurrenceId: "pil", subjectId: "a", name: "Pilates", date: "2026-10-20", startTime: "10:00", endTime: "11:00",
    startsAt: "2026-10-20T13:00:00.000Z", capacity: 8, enrolledCount: 5, machineName: null,
    anotadas: [anotada("1", "Lucía Pérez"), anotada("2", "Marta Gómez", { prueba: true, debe: 5000 })] },
  { ...base, occurrenceId: "m1", subjectId: "a", name: "Reformer 1", date: "2026-10-21", startTime: "09:00", endTime: "10:00",
    startsAt: "2026-10-21T12:00:00.000Z", capacity: 4, enrolledCount: 1, machineName: "Máquina 1", anotadas: [] },
  { ...base, occurrenceId: "m2", subjectId: "b", name: "Reformer 2", date: "2026-10-21", startTime: "09:00", endTime: "10:00",
    startsAt: "2026-10-21T12:00:00.000Z", capacity: 4, enrolledCount: 2, machineName: "Máquina 2", anotadas: [] },
  { ...base, kind: "training", occurrenceId: "cap", subjectId: "t", name: "Curso de masajes", date: "2026-10-22", startTime: "15:00",
    endTime: "17:00", startsAt: "2026-10-22T18:00:00.000Z", capacity: 10, enrolledCount: 3, machineName: null, anotadas: [] },
];

const api = vi.fn(async (_url: string) => ({ success: true, data: CLASES }));
vi.mock("../../api/client", () => ({ api: (url: string) => api(url) }));

const { SemanaGrupal } = await import("./SemanaGrupal");
const { COLOR_DE_TIPO } = await import("../../lib/estado-de-clase");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search = "") {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/semana?date=2026-10-19${search}`]}>
        <Routes>
          <Route path="/semana" element={<SemanaGrupal anchorDate="2026-10-19" />} />
          <Route path="/dia" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SemanaGrupal", () => {
  beforeEach(() => api.mockClear());

  it("pide la semana entera en un solo pedido, de lunes a sábado", async () => {
    montar();
    await screen.findByText("Pilates");
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/api/agenda/classes?from=2026-10-19&to=2026-10-24");
  });

  it("la clase aparece en la columna de su día con nombre, horario y cupo", async () => {
    montar();
    await screen.findByText("Pilates");
    const martes = within(screen.getByTestId("clases-2026-10-20"));
    expect(martes.getByText("Pilates")).toBeInTheDocument();
    expect(martes.getByText("10:00–11:00")).toBeInTheDocument();
    expect(martes.getByText("5/8")).toBeInTheDocument();
  });

  it("dos clases a la misma hora quedan en carriles distintos", async () => {
    montar();
    const a = (await screen.findByText("Reformer 1")).closest("div")!;
    const b = screen.getByText("Reformer 2").closest("div")!;
    expect(a.style.left).not.toBe(b.style.left);
    expect(a.style.width).toBe(b.style.width);
    expect(a.style.width).toContain("50%");
  });

  it("la pastilla tiene el color de su tipo: actividad y capacitación se distinguen", async () => {
    montar();
    const actividad = (await screen.findByText("Pilates")).closest("button")!;
    const capacitacion = screen.getByText("Curso de masajes").closest("button")!;
    expect(actividad.dataset.tipo).toBe("activity");
    expect(capacitacion.dataset.tipo).toBe("training");
    expect(actividad.className).toContain(COLOR_DE_TIPO.activity.pastilla);
    expect(capacitacion.className).toContain(COLOR_DE_TIPO.training.pastilla);
  });

  it("?actividad=a deja sólo las pastillas de a", async () => {
    montar("&actividad=a");
    await screen.findByText("Pilates");
    expect(screen.getByText("Reformer 1")).toBeInTheDocument();
    expect(screen.queryByText("Reformer 2")).not.toBeInTheDocument();
  });

  it("al pasar el mouse muestra quiénes están anotadas", async () => {
    montar();
    const pastilla = (await screen.findByText("Pilates")).closest("button")!;
    expect(screen.queryByText("Lucía Pérez")).not.toBeInTheDocument();
    fireEvent.mouseEnter(pastilla.parentElement!);
    expect(screen.getByText("Lucía Pérez")).toBeInTheDocument();
    expect(screen.getByText("Marta Gómez")).toBeInTheDocument();
    expect(screen.getByText("Prueba")).toBeInTheDocument();
    expect(screen.getByText(/Debe \$/)).toBeInTheDocument();
  });

  it("tocar la pastilla lleva al día conservando el filtro", async () => {
    montar("&actividad=a");
    fireEvent.click((await screen.findByText("Pilates")).closest("button")!);
    const ruta = screen.getByTestId("ubicacion").textContent!;
    expect(ruta).toContain("/dia?");
    expect(ruta).toContain("date=2026-10-20");
    expect(ruta).toContain("actividad=a");
  });
});
