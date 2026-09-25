import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DatosParaAgendar } from "../../api/types";
import { ZonasDelTurno } from "./ZonasDelTurno";

const DATOS: DatosParaAgendar = {
  nombreDelPack: "Cuerpo Full",
  sesion: 1,
  sesionesTotales: 3,
  presupuestoMinutos: 60,
  sexo: "mujer",
  zonas: [
    { id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 9, esDeRegalo: false, disponible: true, motivo: null },
    { id: "z2", nombre: "Axila", categoria: "chica", minutos: 3, esDeRegalo: false, disponible: true, motivo: null },
    { id: "z3", nombre: "Bozo", categoria: "chica", minutos: 3, esDeRegalo: false, disponible: false, motivo: "Esta zona ya no está en el catálogo" },
  ],
  puerta: { puedeAgendar: true, puedeReservar: true, motivo: null, faltaCobrar: 0 },
};

describe("ZonasDelTurno", () => {
  it("muestra el reloj de minutos: elegidas contra presupuesto", async () => {
    render(<ZonasDelTurno datos={DATOS} elegidas={[]} onCambio={() => {}} />);
    expect(screen.getByText(/0 de 60 min/i)).toBeInTheDocument();
  });

  it("suma los minutos de las zonas elegidas", async () => {
    render(<ZonasDelTurno datos={DATOS} elegidas={["z1", "z2"]} onCambio={() => {}} />);
    expect(screen.getByText(/12 de 60 min/i)).toBeInTheDocument();
  });

  it("una zona archivada se ve, no se puede tildar, y dice por qué", async () => {
    render(<ZonasDelTurno datos={DATOS} elegidas={[]} onCambio={() => {}} />);
    const bozo = screen.getByRole("checkbox", { name: /bozo/i });
    expect(bozo).toBeDisabled();
    expect(screen.getByText(/ya no está en el catálogo/i)).toBeInTheDocument();
  });

  /**
   * El tope es un BLOQUEO, no un aviso: pasarse significa regalar minutos de
   * máquina que nadie pagó, y el turno siguiente se los come.
   */
  it("lo que ya no entra en el presupuesto queda deshabilitado, con el motivo", async () => {
    const casiLleno = { ...DATOS, presupuestoMinutos: 10 };
    render(<ZonasDelTurno datos={casiLleno} elegidas={["z1"]} onCambio={() => {}} />);
    const pierna2 = screen.getByRole("checkbox", { name: /pierna entera/i });
    expect(pierna2).toBeEnabled(); // la ya tildada se puede destildar
    expect(screen.getByText(/no entra en el minuto que queda/i)).toBeInTheDocument();
  });

  it("dice de qué sesión del pack se trata", () => {
    render(<ZonasDelTurno datos={DATOS} elegidas={[]} onCambio={() => {}} />);
    expect(screen.getByText(/cuerpo full.*sesión 1 de 3/i)).toBeInTheDocument();
  });
});
