import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarGrid } from "./CalendarGrid";

// Viernes 16/10/2026. Abre 08:00-20:00.
const OPEN_HOURS = [
  { dayOfWeek: 5, openingTime: "08:00", closingTime: "20:00", isOpen: true },
];
const PROVIDERS = [{ id: "prov1", name: "Gabi" }];
// Gabi atiende de 09:00 a 13:00.
const SCHEDULE = [{ providerId: "prov1", windows: [{ start: 540, end: 780 }] }];

function montar(date: string, onSlotClick: (col: string, min: number) => void, providerSchedule?: typeof SCHEDULE) {
  const { container } = render(
    <CalendarGrid
      date={date}
      providers={PROVIDERS}
      openHours={OPEN_HOURS}
      columnMode="provider"
      appointments={[]}
      onSlotClick={onSlotClick}
      onAppointmentClick={vi.fn()}
      providerSchedule={providerSchedule}
    />,
  );
  return container;
}

const slot = (c: HTMLElement, min: number) => c.querySelector(`[data-testid="slot-prov1-${min}"]`) as HTMLElement;

describe("CalendarGrid — horarios que ya pasaron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 12:30 UTC = 09:30 en Buenos Aires.
    vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hoy: el slot de 09:00 (ya pasó) no es clickeable; el de 10:00 sí", () => {
    const onSlotClick = vi.fn();
    const c = montar("2026-10-16", onSlotClick);
    fireEvent.click(slot(c, 9 * 60));
    expect(onSlotClick).not.toHaveBeenCalled();
    fireEvent.click(slot(c, 10 * 60));
    expect(onSlotClick).toHaveBeenCalledWith("prov1", 600);
  });

  it("un día pasado: ningún slot llama a onSlotClick", () => {
    const onSlotClick = vi.fn();
    const c = montar("2026-10-15", onSlotClick);
    fireEvent.click(slot(c, 8 * 60));
    fireEvent.click(slot(c, 10 * 60));
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it("un slot que ya pasó se ve punteado, no con el beige de 'cerrado'", () => {
    const c = montar("2026-10-16", vi.fn());
    expect(slot(c, 9 * 60)).toHaveAttribute("data-hueco", "pasado");
    expect(slot(c, 9 * 60)).not.toHaveClass("bg-surface-high");
    expect(slot(c, 10 * 60)).toHaveAttribute("data-hueco", "libre");
  });

  it("si además la prestadora no atiende, se ve el rayado de 'no atiende'", () => {
    const c = montar("2026-10-16", vi.fn(), SCHEDULE);
    expect(slot(c, 8 * 60)).toHaveAttribute("data-hueco", "no-atiende"); // pasó y no atiende
    expect(slot(c, 9 * 60)).toHaveAttribute("data-hueco", "pasado"); // pasó y atiende
    expect(slot(c, 14 * 60)).toHaveAttribute("data-hueco", "no-atiende"); // futuro, no atiende
  });
});
