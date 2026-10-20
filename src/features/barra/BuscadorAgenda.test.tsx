import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const PRESTADORAS = [
  { id: "p1", fullName: "Romina Suárez", specialties: null },
  { id: "p2", fullName: "Gabi Médica", specialties: null },
];
const SERVICIOS = [{ id: "s1", name: "Rostro completo" }];

vi.mock("../../api/agenda", () => ({
  useProviders: () => ({ data: PRESTADORAS }),
  useServices: () => ({ data: SERVICIOS }),
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
