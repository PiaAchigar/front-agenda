import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

let delServicio: { id: string; fullName: string }[] = [
  { id: "p1", fullName: "Romina" },
  { id: "p2", fullName: "Tamara" },
];
vi.mock("../../api/agenda", () => ({
  useProviders: () => ({ data: [{ id: "p1", fullName: "Romina" }, { id: "p2", fullName: "Tamara" }] }),
  useProvidersByService: () => ({ data: delServicio, isLoading: false }),
}));

const { QuienesLoHacen } = await import("./QuienesLoHacen");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search = "") {
  render(
    <MemoryRouter initialEntries={[`/semana${search}`]}>
      <QuienesLoHacen serviceId="s1" />
      <Ubicacion />
    </MemoryRouter>,
  );
}

describe("QuienesLoHacen", () => {
  it("lista a las prestadoras del servicio", () => {
    montar();
    expect(screen.getByText("La hacen:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Romina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tamara" })).toBeInTheDocument();
  });

  it("tocar una pone ?con= y tocarla de nuevo lo saca", () => {
    montar("?servicio=s1");
    fireEvent.click(screen.getByRole("button", { name: "Romina" }));
    expect(screen.getByTestId("ubicacion").textContent).toContain("con=p1");
    expect(screen.getByRole("button", { name: "Romina" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Romina" }));
    expect(screen.getByTestId("ubicacion").textContent).not.toContain("con=");
  });

  it("sin prestadoras avisa que nadie lo tiene asignado", () => {
    delServicio = [];
    montar();
    expect(screen.getByText("Nadie tiene asignado este servicio todavía.")).toBeInTheDocument();
  });
});
