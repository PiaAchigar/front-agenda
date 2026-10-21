import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PRESTADORAS = [
  { id: "p1", fullName: "Romina Suárez", specialties: null },
  { id: "p2", fullName: "Gabi Médica", specialties: null },
];
const SERVICIOS = [{ id: "s1", name: "Rostro completo" }];

vi.mock("../../api/agenda", () => ({
  useProviders: () => ({ data: PRESTADORAS }),
  useServices: () => ({ data: SERVICIOS }),
}));

vi.mock("../../api/grupal", () => ({
  useActividades: () => ({ data: [{ id: "a1", name: "Pilates" }, { id: "a2", name: "Yoga" }] }),
  useCapacitaciones: () => ({ data: [{ id: "t1", name: "Masaje reductor" }] }),
}));

const { BuscadorAgenda } = await import("./BuscadorAgenda");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(inicial = "/dia") {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <BuscadorAgenda />
      <Ubicacion />
    </MemoryRouter>,
  );
}

const ubicacion = () => screen.getByTestId("ubicacion").textContent;

describe("BuscadorAgenda", () => {
  it("tipear ofrece la prestadora bajo su grupo", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByRole("combobox"), "ro");

    const grupo = screen.getByRole("group", { name: "Prestadoras" });
    expect(within(grupo).getByRole("option", { name: "Romina Suárez" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Servicios" })).toBeInTheDocument();
  });

  it("Enter elige la primera con las flechas y la pone en la URL", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByRole("combobox"), "rom");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(ubicacion()).toContain("prestadora=p1");
  });

  it("elegir NO reemplaza al input por un chip: sigue vacío y listo para tipear", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByRole("combobox"), "rom");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.queryByText("Romina Suárez")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar búsqueda" })).not.toBeInTheDocument();
  });

  it("se pueden sumar varias prestadoras y servicios, y repetir una no hace nada", async () => {
    const user = userEvent.setup();
    montar();
    const caja = () => screen.getByRole("combobox");

    await user.type(caja(), "rom");
    await user.click(screen.getByRole("option", { name: "Romina Suárez" }));
    await user.type(caja(), "gab");
    await user.click(screen.getByRole("option", { name: "Gabi Médica" }));
    await user.type(caja(), "ros");
    await user.click(screen.getByRole("option", { name: "Rostro completo" }));
    await user.type(caja(), "rom");
    await user.click(screen.getByRole("option", { name: "Romina Suárez" }));

    const u = new URL("http://x" + ubicacion());
    expect(u.searchParams.getAll("prestadora")).toEqual(["p1", "p2"]);
    expect(u.searchParams.getAll("servicio")).toEqual(["s1"]);
  });

  it("elegir un servicio lo pone en la URL", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByRole("combobox"), "ros");
    await user.click(screen.getByRole("option", { name: "Rostro completo" }));

    expect(ubicacion()).toContain("servicio=s1");
  });

  it("Esc cierra la lista y limpia el texto", async () => {
    const user = userEvent.setup();
    montar();

    const caja = screen.getByRole("combobox");
    await user.type(caja, "rom");
    await user.keyboard("{Escape}");

    expect(caja).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("BuscadorAgenda en turnos grupales", () => {
  beforeEach(() => localStorage.setItem("agenda-mode", "clases"));
  afterEach(() => localStorage.removeItem("agenda-mode"));

  it("sugiere actividades y capacitaciones, y elegir agrega a la URL y vacía el input", async () => {
    const user = userEvent.setup();
    montar();
    const input = screen.getByRole("combobox", { name: "Buscar actividad o capacitación" });
    expect(input).toHaveAttribute("placeholder", "Buscar actividad o capacitación…");
    expect(input).toHaveAttribute("title", "Buscar actividad o capacitación");

    await user.type(input, "pil");
    const grupo = screen.getByRole("group", { name: "Actividades" });
    await user.click(within(grupo).getByRole("option", { name: "Pilates" }));

    expect(ubicacion()).toBe("/dia?actividad=a1");
    expect(input).toHaveValue("");
  });

  it("sugiere capacitaciones bajo su grupo", async () => {
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByRole("combobox"), "masa");
    const grupo = screen.getByRole("group", { name: "Capacitaciones" });
    await user.click(within(grupo).getByRole("option", { name: "Masaje reductor" }));
    expect(ubicacion()).toBe("/dia?capacitacion=t1");
  });

  it("el nombre de una prestadora no sugiere nada", async () => {
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByRole("combobox"), "romina");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("usa el mismo input y el mismo ancho que en individual", () => {
    const { unmount } = montar();
    const clases = screen.getByRole("combobox").className;
    unmount();
    localStorage.removeItem("agenda-mode");
    montar();
    expect(screen.getByRole("combobox").className).toBe(clases);
  });
});
