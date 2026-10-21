import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PRESTADORAS = [
  { id: "p1", fullName: "Romina", specialties: null },
  { id: "p2", fullName: "Tamara", specialties: null },
  { id: "p3", fullName: "Gabi", specialties: null },
];
const SERVICIOS = [
  { id: "s1", name: "Limpieza facial" },
  { id: "s2", name: "Masaje" },
];
let porServicio = new Map<string, typeof PRESTADORAS>();
let cargando = false;
let fallo = false;

vi.mock("../../api/agenda", () => ({
  useProviders: () => ({ data: PRESTADORAS }),
  useServices: () => ({ data: SERVICIOS }),
  useProvidersByServices: () => ({ porServicio, cargando, fallo }),
}));

vi.mock("../../api/grupal", () => ({
  useActividades: () => ({ data: [{ id: "a1", name: "Pilates" }, { id: "a2", name: "Yoga" }] }),
  useCapacitaciones: () => ({ data: [{ id: "t1", name: "Masaje reductor" }] }),
}));

const { FiltrosAgenda } = await import("./FiltrosAgenda");

function Ubicacion() {
  const l = useLocation();
  return <p data-testid="ubicacion">{l.pathname + l.search}</p>;
}

function montar(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/semana${search}`]}>
      <FiltrosAgenda />
      <Ubicacion />
    </MemoryRouter>,
  );
}
const ubicacion = () => screen.getByTestId("ubicacion").textContent!;

describe("FiltrosAgenda", () => {
  beforeEach(() => {
    porServicio = new Map([
      ["s1", [PRESTADORAS[0]!, PRESTADORAS[1]!]],
      ["s2", [PRESTADORAS[1]!, PRESTADORAS[2]!]],
    ]);
    cargando = false;
    fallo = false;
  });

  it("sin filtros muestra el texto suave, siempre presente", () => {
    montar();
    expect(screen.getByText("Elegí una prestadora o un servicio en el buscador para filtrar")).toBeInTheDocument();
    expect(screen.getByTestId("filtros-agenda")).toBeInTheDocument();
  });

  it("un chip por filtro, cada uno con su ×, y el texto vacío desaparece", () => {
    montar("?prestadora=p1&prestadora=p3&servicio=s2");
    for (const n of ["Romina", "Gabi", "Masaje"]) {
      expect(screen.getByText(n)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Quitar ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByText(/Elegí una prestadora/)).not.toBeInTheDocument();
  });

  it("la × saca sólo ese chip y conserva el resto de la URL", () => {
    montar("?prestadora=p1&prestadora=p3&servicio=s2&date=2026-10-19");
    fireEvent.click(screen.getByRole("button", { name: "Quitar Romina" }));
    const u = new URL("http://x" + ubicacion());
    expect(u.searchParams.getAll("prestadora")).toEqual(["p3"]);
    expect(u.searchParams.getAll("servicio")).toEqual(["s2"]);
    expect(u.searchParams.get("date")).toBe("2026-10-19");
  });

  it("la altura es fija: no cambia con chips, y el desborde scrollea sin envolver", () => {
    const { unmount } = montar();
    const vacia = screen.getByTestId("filtros-agenda").className;
    unmount();
    montar("?prestadora=p1&prestadora=p2&prestadora=p3&servicio=s1&servicio=s2");
    const llena = screen.getByTestId("filtros-agenda");
    expect(llena.className).toBe(vacia);
    expect(llena.className).toMatch(/\bh-\d/);
    expect(llena.className).toContain("overflow-x-auto");
    expect(llena.className).not.toContain("flex-wrap");
  });

  it("con un servicio elegido: 'La hacen:' con las que lo hacen y no están elegidas", () => {
    montar("?servicio=s1&prestadora=p1");
    expect(screen.getByText("La hacen:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tamara" })).toBeInTheDocument();
    // Romina ya es chip: no se ofrece de nuevo para sumar.
    expect(screen.queryByRole("button", { name: "Romina" })).not.toBeInTheDocument();
  });

  it("con 2 servicios ofrece las de cualquiera, sin repetir", () => {
    montar("?servicio=s1&servicio=s2");
    expect(screen.getAllByRole("button", { name: "Tamara" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Romina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gabi" })).toBeInTheDocument();
  });

  it("tocar una de 'La hacen:' la suma como prestadora", () => {
    montar("?servicio=s1");
    fireEvent.click(screen.getByRole("button", { name: "Tamara" }));
    const u = new URL("http://x" + ubicacion());
    expect(u.searchParams.getAll("prestadora")).toEqual(["p2"]);
    expect(u.searchParams.getAll("servicio")).toEqual(["s1"]);
    expect(u.searchParams.has("con")).toBe(false);
    // Ahora es chip con ×, ya no es para sumar.
    expect(screen.getByRole("button", { name: "Quitar Tamara" })).toBeInTheDocument();
  });

  it("si nadie hace los servicios elegidos avisa", () => {
    porServicio = new Map([["s1", []]]);
    montar("?servicio=s1");
    expect(screen.getByText("Nadie tiene asignado este servicio todavía.")).toBeInTheDocument();
    expect(screen.queryByText("La hacen:")).not.toBeInTheDocument();
  });

  it("mientras cargan no dice que nadie lo hace", () => {
    porServicio = new Map();
    cargando = true;
    montar("?servicio=s1");
    expect(screen.queryByText("Nadie tiene asignado este servicio todavía.")).not.toBeInTheDocument();
  });

  it("si falló la consulta no dice que nadie lo hace: avisa suave", () => {
    porServicio = new Map();
    fallo = true;
    montar("?servicio=s1");
    expect(screen.queryByText("Nadie tiene asignado este servicio todavía.")).not.toBeInTheDocument();
    expect(screen.getByText("No se pudo cargar quién lo hace.")).toBeInTheDocument();
  });
});

describe("FiltrosAgenda en turnos grupales", () => {
  beforeEach(() => localStorage.setItem("agenda-mode", "clases"));
  afterEach(() => localStorage.removeItem("agenda-mode"));

  it("muestra el chip de la actividad y no el de la prestadora; su × saca sólo la actividad", () => {
    montar("?actividad=a1&prestadora=p1");
    expect(screen.getByText("Pilates")).toBeInTheDocument();
    expect(screen.queryByText("Romina")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar Pilates" }));
    expect(ubicacion()).toBe("/semana?prestadora=p1");
  });

  it("si el nombre no se encuentra usa Actividad / Capacitación", () => {
    montar("?actividad=zz&capacitacion=yy");
    expect(screen.getByText("Actividad")).toBeInTheDocument();
    expect(screen.getByText("Capacitación")).toBeInTheDocument();
  });

  it("sin filtros invita a elegir", () => {
    montar();
    expect(screen.getByText(/Elegí una actividad o una capacitación/)).toBeInTheDocument();
  });
});
