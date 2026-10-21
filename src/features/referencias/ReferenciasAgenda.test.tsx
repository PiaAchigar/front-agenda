import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenciasAgenda } from "./ReferenciasAgenda";

afterEach(() => localStorage.clear());

const boton = () => screen.getByRole("button", { name: /referencias/i });

describe("ReferenciasAgenda", () => {
  it("arranca cerrado", () => {
    render(<ReferenciasAgenda />);
    expect(boton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Ya pasó")).not.toBeInTheDocument();
  });

  it("al tocarlo explica cada fondo de horario y cada señal de los turnos", async () => {
    const user = userEvent.setup();
    render(<ReferenciasAgenda />);
    await user.click(boton());
    expect(boton()).toHaveAttribute("aria-expanded", "true");
    for (const nombre of ["Libre", "Ya pasó", "No atiende", "Local cerrado", "Día en verde", "Agendado", "Completado", "Ausente", "Reserva", "Debe $X"]) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }
  });

  it("las muestras de horario usan el mismo fondo que la grilla", async () => {
    const user = userEvent.setup();
    const { container } = render(<ReferenciasAgenda />);
    await user.click(boton());
    for (const tipo of ["libre", "pasado", "no-atiende", "cerrado"]) {
      expect(container.querySelector(`[data-hueco="${tipo}"]`)).not.toBeNull();
    }
  });

  it("se cierra con Esc y devuelve el foco al botón", async () => {
    const user = userEvent.setup();
    render(<ReferenciasAgenda />);
    await user.click(boton());
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Ya pasó")).not.toBeInTheDocument();
    expect(boton()).toHaveFocus();
  });

  it("se cierra con un clic afuera", async () => {
    const user = userEvent.setup();
    render(<div><p>afuera</p><ReferenciasAgenda /></div>);
    await user.click(boton());
    fireEvent.pointerDown(screen.getByText("afuera"));
    expect(screen.queryByText("Ya pasó")).not.toBeInTheDocument();
  });

  it("en modo clases explica el cupo, la prueba y la deuda, y no lo de los turnos", async () => {
    localStorage.setItem("agenda-mode", "clases");
    const user = userEvent.setup();
    render(<ReferenciasAgenda />);
    await user.click(boton());
    for (const nombre of ["Con lugar", "Llena", "Sobrecupo"]) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }
    // "Prueba" y "Debe $X" también son la pastilla de muestra, además del nombre.
    expect(screen.getAllByText("Prueba").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Debe $X").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Libre")).not.toBeInTheDocument();
    expect(screen.queryByText("Agendado")).not.toBeInTheDocument();
    localStorage.clear();
  });

  it("en modo turnos no muestra lo de las clases", async () => {
    const user = userEvent.setup();
    render(<ReferenciasAgenda />);
    await user.click(boton());
    expect(screen.getByText("Libre")).toBeInTheDocument();
    expect(screen.queryByText("Con lugar")).not.toBeInTheDocument();
    expect(screen.queryByText("Sobrecupo")).not.toBeInTheDocument();
  });
});
