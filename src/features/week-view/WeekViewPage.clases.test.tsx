import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Las clases quedan pendientes; el resto de los pedidos de la pantalla contesta vacío.
const api = vi.fn((url: string): Promise<unknown> =>
  url.includes("/classes") ? new Promise(() => {}) : Promise.resolve({ success: true, data: [] }));
vi.mock("../../api/client", () => ({ api: (url: string) => api(url) }));

const { WeekViewPage } = await import("./WeekViewPage");
const { MonthViewPage } = await import("../month-view/MonthViewPage");

function montar(ruta: string, el: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[ruta]}>{el}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Semana y Mes grupales mientras cargan las clases", () => {
  beforeEach(() => { localStorage.setItem("agenda-mode", "clases"); });

  it("semana: no mete texto sobre la grilla y el spinner va en la barra", async () => {
    const { container } = montar("/semana?date=2026-10-19", <WeekViewPage />);
    await screen.findByTestId("clases-2026-10-19");
    expect(screen.queryByText(/Cargando clases/)).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("mes: no mete texto sobre la grilla y el spinner va en la barra", async () => {
    const { container } = montar("/mes?date=2026-10-19", <MonthViewPage />);
    await screen.findByTestId("dia-2026-10-19");
    expect(screen.queryByText(/Cargando clases/)).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("cada columna de la semana está aislada (isolate) para no pisar la hora ni el encabezado", async () => {
    montar("/semana?date=2026-10-19", <WeekViewPage />);
    expect((await screen.findByTestId("clases-2026-10-19")).className).toContain("isolate");
  });
});
