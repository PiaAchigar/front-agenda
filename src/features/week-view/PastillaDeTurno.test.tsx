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

  it("con el dedo, el primer toque muestra la ficha y NO abre el turno; el segundo lo abre", () => {
    const onAbrir = montar();
    const b = screen.getByRole("button");
    fireEvent.pointerDown(b, { pointerType: "touch" });
    fireEvent.click(b);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(onAbrir).not.toHaveBeenCalled();

    fireEvent.pointerDown(b, { pointerType: "touch" });
    fireEvent.click(b);
    expect(onAbrir).toHaveBeenCalledTimes(1);
  });

  it("con el dedo, tocar afuera cierra la ficha y el próximo toque vuelve a ser el primero", () => {
    const onAbrir = montar();
    const b = screen.getByRole("button");
    fireEvent.pointerDown(b, { pointerType: "touch" });
    fireEvent.click(b);
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.pointerDown(b, { pointerType: "touch" });
    fireEvent.click(b);
    expect(onAbrir).not.toHaveBeenCalled();
  });

  it("después de un toque, activar con el teclado (clic sin pointerdown) abre el turno al primer Enter", () => {
    const onAbrir = montar();
    const b = screen.getByRole("button");
    fireEvent.pointerDown(b, { pointerType: "touch" });
    fireEvent.click(b);
    fireEvent.pointerDown(document.body, { pointerType: "touch" });

    fireEvent.click(b, { detail: 0 });
    expect(onAbrir).toHaveBeenCalledTimes(1);
  });
});

describe("PastillaDeTurno — la ficha no se corta contra los bordes", () => {
  function rectDe(r: Partial<DOMRect>) {
    const base = { x: 0, y: 0, width: 80, height: 60, top: 0, left: 0, right: 80, bottom: 60, toJSON: () => ({}) };
    return () => ({ ...base, ...r }) as DOMRect;
  }
  function conRect(r: Partial<DOMRect>) {
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = rectDe(r);
    return () => { HTMLElement.prototype.getBoundingClientRect = original; };
  }

  it("en la última columna se corre a la izquierda para entrar en la pantalla", () => {
    const restaurar = conRect({ left: window.innerWidth - 60, right: window.innerWidth + 20, top: 100, bottom: 160 });
    try {
      montar();
      fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
      const izq = parseFloat(screen.getByRole("tooltip").style.left);
      expect(izq + 208).toBeLessThanOrEqual(window.innerWidth);
    } finally { restaurar(); }
  });

  it("al pie de la pantalla se abre hacia arriba de la pastilla", () => {
    const restaurar = conRect({ left: 100, right: 180, top: window.innerHeight - 40, bottom: window.innerHeight - 5 });
    try {
      montar();
      fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
      const top = parseFloat(screen.getByRole("tooltip").style.top);
      expect(top).toBeLessThan(window.innerHeight - 40);
    } finally { restaurar(); }
  });

  it("lejos de los bordes queda debajo de la pastilla", () => {
    const restaurar = conRect({ left: 100, right: 180, top: 100, bottom: 160 });
    try {
      montar();
      fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
      expect(parseFloat(screen.getByRole("tooltip").style.top)).toBeGreaterThanOrEqual(160);
    } finally { restaurar(); }
  });
});
