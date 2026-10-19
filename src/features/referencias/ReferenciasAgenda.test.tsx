import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ReferenciasAgenda } from "./ReferenciasAgenda";

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
    for (const nombre of ["Libre", "Ya pasó", "No atiende", "Local cerrado", "Agendado", "Completado", "Ausente", "Reserva"]) {
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
});
