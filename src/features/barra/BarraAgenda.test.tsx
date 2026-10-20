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

  it("marca la solapa de la vista actual, y en el día ninguna", () => {
    const { unmount } = montar("semana");
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Mes" })).not.toHaveAttribute("aria-current");
    unmount();

    montar("dia", "/dia");
    expect(screen.getByRole("button", { name: "Semana" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Mes" })).not.toHaveAttribute("aria-current");
  });

  it("Turnos grupales desde Semana conserva la búsqueda al saltar al día", async () => {
    const user = userEvent.setup();
    montar("semana", "/semana?prestadora=p1&date=2026-10-19");

    await user.click(screen.getByRole("button", { name: "Turnos grupales" }));

    expect(ubicacion()).toBe("/dia?prestadora=p1&date=2026-10-19");
  });

  it("Turnos grupales desde Semana lleva al día y deshabilita Semana y Mes", async () => {
    const user = userEvent.setup();
    montar("semana");

    await user.click(screen.getByRole("button", { name: "Turnos grupales" }));

    expect(ubicacion()).toBe("/dia");
    expect(localStorage.getItem("agenda-mode")).toBe("clases");
    for (const n of ["Semana", "Mes"]) {
      const b = screen.getByRole("button", { name: n });
      expect(b).toHaveAttribute("aria-disabled", "true");
      expect(b).toHaveAttribute("title", "Por ahora las clases se ven por día");
    }
  });

  it("con las clases activas, tocar Semana no navega", async () => {
    localStorage.setItem("agenda-mode", "clases");
    const user = userEvent.setup();
    montar("dia", "/dia");

    await user.click(screen.getByRole("button", { name: "Semana" }));
    expect(ubicacion()).toBe("/dia");
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

  it("volver a Turnos individuales rehabilita las solapas", async () => {
    localStorage.setItem("agenda-mode", "clases");
    const user = userEvent.setup();
    montar("dia", "/dia");

    await user.click(screen.getByRole("button", { name: "Turnos individuales" }));
    expect(screen.getByRole("button", { name: "Semana" })).not.toHaveAttribute("aria-disabled");
  });

  it("al entrar a Semana o Mes con el modo grupal guardado, vuelve a Turnos individuales", () => {
    localStorage.setItem("agenda-mode", "clases");
    montar("mes", "/mes");

    expect(localStorage.getItem("agenda-mode")).toBe("turnos");
    expect(screen.getByRole("button", { name: "Semana" })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("button", { name: "Turnos individuales" }).className).toContain("bg-primary");
  });
});
