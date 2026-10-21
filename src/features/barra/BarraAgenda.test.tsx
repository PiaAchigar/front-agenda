import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BarraAgenda } from "./BarraAgenda";

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(vista: "dia" | "semana" | "mes", inicial = "/semana") {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <BarraAgenda vista={vista} fecha={<span>la fecha</span>} buscador={<span>el buscador</span>} />
      <Routes>
        <Route path="*" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>,
  );
}

const ubicacion = () => screen.getByTestId("ubicacion").textContent;

afterEach(() => localStorage.clear());

describe("BarraAgenda", () => {
  it("tiene los dos modos, Semana, Mes y Referencias; no Día, Por servicio ni Nuevo turno", () => {
    montar("semana");

    for (const n of ["Turnos individuales", "Turnos grupales", "Semana", "Mes", "Referencias de colores"]) {
      expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    }
    for (const n of [/^día$/i, /por servicio/i, /nuevo turno/i]) {
      expect(screen.queryByRole("button", { name: n })).not.toBeInTheDocument();
    }
    expect(screen.getByText("la fecha")).toBeInTheDocument();
    expect(screen.getByText("el buscador")).toBeInTheDocument();
  });

  it("va en un solo renglón y cada botón muestra su texto entero al pasar el mouse", () => {
    const { container } = montar("semana");

    expect(container.firstElementChild).toHaveClass("flex-nowrap");
    for (const n of ["Turnos individuales", "Turnos grupales", "Semana", "Mes"]) {
      expect(screen.getByRole("button", { name: n })).toHaveAttribute("title", n);
    }
  });

  it("Referencias es sólo el ícono, con el nombre al pasar el mouse", () => {
    montar("semana");

    expect(screen.getByRole("button", { name: "Referencias de colores" })).toHaveAttribute("title", "Referencias");
    expect(screen.queryByText("Referencias")).not.toBeInTheDocument();
  });

  it("marca la solapa de la vista actual, y en el día ninguna", () => {
    const { unmount } = montar("semana");
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Mes" })).not.toHaveAttribute("aria-current");
    unmount();

    montar("dia", "/dia");
    expect(screen.getByRole("button", { name: "Semana" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Mes" })).not.toHaveAttribute("aria-current");
  });

  it("Turnos grupales estando en Semana no navega y deja el modo en clases", async () => {
    const user = userEvent.setup();
    montar("semana", "/semana?prestadora=p1&date=2026-10-19");

    await user.click(screen.getByRole("button", { name: "Turnos grupales" }));

    expect(ubicacion()).toBe("/semana?prestadora=p1&date=2026-10-19");
    expect(localStorage.getItem("agenda-mode")).toBe("clases");
    await user.click(screen.getByRole("button", { name: "Turnos individuales" }));
    expect(ubicacion()).toBe("/semana?prestadora=p1&date=2026-10-19");
    expect(localStorage.getItem("agenda-mode")).toBe("turnos");
  });

  it.each(["turnos", "clases"])("con modo %s, en Día, Semana y Mes están buscador, Referencias, Semana y Mes habilitados", (modo) => {
    localStorage.setItem("agenda-mode", modo);
    for (const [vista, ruta] of [["dia", "/dia"], ["semana", "/semana"], ["mes", "/mes"]] as const) {
      const { unmount } = montar(vista, ruta);
      expect(screen.getByText("el buscador")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Referencias de colores" })).toBeInTheDocument();
      for (const n of ["Semana", "Mes"]) {
        expect(screen.getByRole("button", { name: n })).not.toHaveAttribute("aria-disabled");
      }
      unmount();
    }
  });

  it("con las clases activas, tocar Semana navega", async () => {
    localStorage.setItem("agenda-mode", "clases");
    const user = userEvent.setup();
    montar("dia", "/dia");

    await user.click(screen.getByRole("button", { name: "Semana" }));
    expect(ubicacion()).toBe("/semana");
    expect(localStorage.getItem("agenda-mode")).toBe("clases");
  });

  it("tocar Semana conserva todas las prestadoras y servicios, y date", async () => {
    const user = userEvent.setup();
    montar("dia", "/dia?servicio=s1&servicio=s2&prestadora=p1&prestadora=p3&date=2026-10-19&otra=x");

    await user.click(screen.getByRole("button", { name: "Semana" }));

    const url = new URL(ubicacion()!, "http://x");
    expect(url.pathname).toBe("/semana");
    expect(url.searchParams.getAll("servicio")).toEqual(["s1", "s2"]);
    expect(url.searchParams.getAll("prestadora")).toEqual(["p1", "p3"]);
    expect(url.searchParams.get("date")).toBe("2026-10-19");
    expect(url.searchParams.has("otra")).toBe(false);
  });

  it("al entrar a Semana o Mes con el modo grupal guardado, no lo pisa", () => {
    localStorage.setItem("agenda-mode", "clases");
    montar("mes", "/mes");

    expect(localStorage.getItem("agenda-mode")).toBe("clases");
    expect(screen.getByRole("button", { name: "Turnos grupales" }).className).toContain("bg-primary");
  });
});
