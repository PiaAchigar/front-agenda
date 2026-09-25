import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DatosParaAgendar } from "../../api/types";
import { ZonasDelTurno } from "./ZonasDelTurno";

const DATOS: DatosParaAgendar = {
  nombreDelPack: "Cuerpo Full",
  sesion: 1,
  sesionesTotales: 3,
  presupuestoMinutos: 60,
  zonasDeRegalo: 0,
  sexo: "mujer",
  zonas: [
    { id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 9, esDeRegalo: false, disponible: true, motivo: null },
    { id: "z2", nombre: "Axila", categoria: "chica", minutos: 3, esDeRegalo: false, disponible: true, motivo: null },
    { id: "z3", nombre: "Bozo", categoria: "chica", minutos: 3, esDeRegalo: false, disponible: false, motivo: "Esta zona ya no está en el catálogo" },
  ],
  puerta: { puedeAgendar: true, puedeReservar: true, motivo: null, faltaCobrar: 0 },
  serviceId: "svc-ancla",
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

  /**
   * Ronda de arreglos 3 (Minor 3). El spec §7.2 dice "hasta N zonas a
   * elección" y el menú ofrecía TODAS las chicas activas: con "Combo de
   * Esenciales" (1 a elección, 30') se podían tildar 4 zonas de regalo
   * porque los minutos daban. El servidor ahora lo rechaza; el menú tiene
   * que dejar de ofrecerlo, o Laura se entera recién al apretar Agendar.
   */
  it("con el cupo de regalo lleno, las otras zonas de regalo quedan deshabilitadas", async () => {
    const conRegalo: DatosParaAgendar = {
      ...DATOS,
      zonasDeRegalo: 1,
      zonas: [
        DATOS.zonas[0]!,
        { id: "r1", nombre: "Bigote", categoria: "chica", minutos: 3, esDeRegalo: true, disponible: true, motivo: null },
        { id: "r2", nombre: "Mentón", categoria: "chica", minutos: 3, esDeRegalo: true, disponible: true, motivo: null },
      ],
    };
    render(<ZonasDelTurno datos={conRegalo} elegidas={["r1"]} onCambio={() => {}} />);

    // La tildada se puede destildar; la otra de regalo, no.
    expect(screen.getByRole("checkbox", { name: /bigote/i })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /mentón/i })).toBeDisabled();
    expect(screen.getByText(/hasta 1 zona a elección/i)).toBeInTheDocument();
    // Y una zona del PACK no se ve afectada: el cupo es sólo de las de regalo.
    expect(screen.getByRole("checkbox", { name: /pierna entera/i })).toBeEnabled();
  });

  /**
   * Diferido #7. `quedan = presupuesto - usados` podía dar negativo cuando el
   * presupuesto nuevo (al cambiar el selector de sexo) queda por debajo de lo
   * ya tildado: el motivo decía "No entra en los -3 min que quedan", con la
   * clienta enfrente. El modal limpia la selección al cambiar de sexo, pero
   * el componente no puede confiar en eso: nunca un número negativo.
   */
  it("nunca muestra minutos restantes en negativo", () => {
    const pasado = { ...DATOS, presupuestoMinutos: 5 };
    render(<ZonasDelTurno datos={pasado} elegidas={["z1"]} onCambio={() => {}} />);
    expect(screen.getByText(/9 de 5 min/i)).toBeInTheDocument();
    expect(screen.queryByText(/-\d+ min/)).not.toBeInTheDocument();
    expect(screen.getByText(/no entra en los 0 min que quedan/i)).toBeInTheDocument();
  });

  it("dice de qué sesión del pack se trata", () => {
    render(<ZonasDelTurno datos={DATOS} elegidas={[]} onCambio={() => {}} />);
    expect(screen.getByText(/cuerpo full.*sesión 1 de 3/i)).toBeInTheDocument();
  });
});
