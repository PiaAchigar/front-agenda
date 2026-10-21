import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useModoAgenda } from "./modo-agenda";
import { rutaDeGrupales, useIrAGrupales } from "./ir-a-grupales";

describe("rutaDeGrupales", () => {
  it("va al Día de esa fecha, filtrado por esa actividad o capacitación", () => {
    expect(rutaDeGrupales("actividad", "a1", "2027-01-20")).toBe("/dia?date=2027-01-20&actividad=a1");
    expect(rutaDeGrupales("capacitacion", "t1", "2027-01-20")).toBe("/dia?date=2027-01-20&capacitacion=t1");
  });
});

describe("useIrAGrupales", () => {
  beforeEach(() => localStorage.clear());

  it("pasa a Turnos grupales y navega con el filtro", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={["/semana"]}>{children}</MemoryRouter>;
    const { result } = renderHook(() => ({ ir: useIrAGrupales(), modo: useModoAgenda()[0], loc: useLocation() }), { wrapper });
    act(() => result.current.ir("actividad", "a1", "2027-01-20"));
    expect(result.current.modo).toBe("clases");
    expect(result.current.loc.pathname + result.current.loc.search).toBe("/dia?date=2027-01-20&actividad=a1");
  });
});
