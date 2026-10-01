import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityCalendar } from "./AvailabilityCalendar";

const HOY = "2026-10-10";

function montar(over: Partial<React.ComponentProps<typeof AvailabilityCalendar>> = {}) {
  const onSelectDay = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <AvailabilityCalendar
      month="2026-10"
      selected={null}
      availableDays={new Set(["2026-10-12", "2026-10-19", "2026-10-05"])}
      loading={false}
      hoy={HOY}
      onSelectDay={onSelectDay}
      onMonthChange={onMonthChange}
      {...over}
    />,
  );
  return { onSelectDay, onMonthChange };
}

describe("AvailabilityCalendar", () => {
  it("muestra el mes en español y los días de la semana desde el lunes", () => {
    montar();
    expect(screen.getByText("Octubre de 2026")).toBeInTheDocument();
    expect(screen.getByText("Lun")).toBeInTheDocument();
    expect(screen.getByText("Dom")).toBeInTheDocument();
  });

  it("un día con hueco es clickeable y está marcado como disponible", async () => {
    const user = userEvent.setup();
    const { onSelectDay } = montar();
    const dia = screen.getByRole("button", { name: "12" });
    expect(dia).toBeEnabled();
    expect(dia).toHaveAttribute("data-disponible", "true");
    await user.click(dia);
    expect(onSelectDay).toHaveBeenCalledWith("2026-10-12");
  });

  it("un día sin hueco está apagado y no responde al click", async () => {
    const user = userEvent.setup();
    const { onSelectDay } = montar();
    const dia = screen.getByRole("button", { name: "13" });
    expect(dia).toBeDisabled();
    expect(dia).toHaveAttribute("data-disponible", "false");
    await user.click(dia);
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("un día PASADO nunca es clickeable, aunque el backend lo diga disponible", () => {
    montar(); // el 5 está en availableDays pero hoy es el 10
    expect(screen.getByRole("button", { name: "5" })).toBeDisabled();
  });

  it("mientras carga el mes, todos los días están apagados (no parece 'sin horarios')", () => {
    montar({ loading: true });
    expect(screen.getByRole("button", { name: "12" })).toBeDisabled();
  });

  it("marca el día elegido", () => {
    montar({ selected: "2026-10-19" });
    expect(screen.getByRole("button", { name: "19" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "12" })).toHaveAttribute("aria-pressed", "false");
  });

  it("las flechas piden el mes siguiente y el anterior", async () => {
    const user = userEvent.setup();
    const { onMonthChange } = montar({ month: "2026-11", hoy: "2026-10-10" });
    await user.click(screen.getByRole("button", { name: /mes siguiente/i }));
    expect(onMonthChange).toHaveBeenLastCalledWith("2026-12");
    await user.click(screen.getByRole("button", { name: /mes anterior/i }));
    expect(onMonthChange).toHaveBeenLastCalledWith("2026-10");
  });

  it("no se puede ir a un mes anterior al de hoy", () => {
    montar({ month: "2026-10" });
    expect(screen.getByRole("button", { name: /mes anterior/i })).toBeDisabled();
  });

  it("un mes sin ningún hueco queda todo apagado pero se puede seguir navegando", () => {
    montar({ month: "2026-11", availableDays: new Set() });
    expect(screen.getByRole("button", { name: "15" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /mes siguiente/i })).toBeEnabled();
  });
});
