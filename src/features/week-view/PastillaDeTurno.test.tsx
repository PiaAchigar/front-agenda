import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PastillaDeTurno } from "./PastillaDeTurno";
import type { Appointment } from "../../api/types";

const turno = {
  id: "a1",
  status: "scheduled",
  reservationExpiresAt: null,
  appointmentStart: "2026-10-21T13:00:00.000Z", // 10:00 ART
  appointmentEnd: "2026-10-21T14:00:00.000Z",
  customerName: "Sofía Herrera",
  providerName: "Romina Suárez",
  serviceName: "Limpieza facial",
} as Appointment;

function montar(extra: Partial<Appointment> = {}, onAbrir = vi.fn()) {
  render(
    <PastillaDeTurno
      turno={{ ...turno, ...extra }}
      color={{ bg: "#dbeafe", text: "#1d4ed8" }}
      carril={1}
      total={2}
      top={120}
      alto={60}
      onAbrir={onAbrir}
    />,
  );
  return onAbrir;
}

describe("PastillaDeTurno", () => {
  it("es un botón con el color de la prestadora y sin tooltip hasta el hover", () => {
    montar();
    const b = screen.getByRole("button");
    expect(b).toHaveStyle({ backgroundColor: "#dbeafe" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("al pasar el mouse muestra horario, prestadora, clienta y servicio, ligados por aria-describedby", () => {
    montar();
    const b = screen.getByRole("button");
    fireEvent.mouseEnter(b);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("10:00–11:00");
    expect(tip).toHaveTextContent("Romina Suárez");
    expect(tip).toHaveTextContent("Sofía Herrera");
    expect(tip).toHaveTextContent("Limpieza facial");
    expect(b.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.mouseLeave(b);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("al tomar el foco también muestra la ficha", () => {
    montar();
    fireEvent.focus(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("el clic abre el turno", () => {
    const onAbrir = montar();
    fireEvent.click(screen.getByRole("button"));
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
  });

  it("una reserva lleva borde punteado ámbar y ⏳", () => {
    montar({ status: "reserved", reservationExpiresAt: "2099-01-01T00:00:00Z" });
    const b = screen.getByRole("button");
    expect(b.className).toContain("border-dashed");
    expect(b).toHaveTextContent("⏳");
  });
});
