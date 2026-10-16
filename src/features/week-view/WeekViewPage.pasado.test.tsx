import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/agenda", () => ({
  useProviders: () => ({ data: [] }),
  useCompanyConfig: () => ({
    data: { openHours: [1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openingTime: "08:00", closingTime: "20:00", isOpen: true })) },
  }),
}));
vi.mock("../../api/client", () => ({ api: vi.fn().mockResolvedValue([]) }));
vi.mock("../day-view/NewAppointmentModal", () => ({
  NewAppointmentModal: ({ date, prefill }: { date: string; prefill: { minutes?: number } | null }) => (
    <div data-testid="modal-nuevo">{`${date} ${prefill?.minutes}`}</div>
  ),
}));

const { WeekViewPage } = await import("./WeekViewPage");

function montar() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WeekViewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WeekViewPage — horarios que ya pasaron", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 12:30 UTC = 09:30 en Buenos Aires, viernes 16/10/2026.
    vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un slot que ya pasó no abre el modal y se ve deshabilitado; uno futuro sí", () => {
    montar();
    const pasado = screen.getByTestId("slot-2026-10-16-540"); // 09:00
    expect(pasado).toHaveAttribute("aria-disabled", "true");
    expect(pasado).not.toHaveTextContent("+");
    fireEvent.click(pasado);
    expect(screen.queryByTestId("modal-nuevo")).not.toBeInTheDocument();

    const futuro = screen.getByTestId("slot-2026-10-16-600"); // 10:00
    expect(futuro).not.toHaveAttribute("aria-disabled");
    fireEvent.click(futuro);
    expect(screen.getByTestId("modal-nuevo")).toHaveTextContent("2026-10-16 600");
  });

  it("un día anterior de la semana: ningún slot abre el modal", () => {
    montar();
    fireEvent.click(screen.getByTestId("slot-2026-10-14-600"));
    expect(screen.queryByTestId("modal-nuevo")).not.toBeInTheDocument();
  });
});
