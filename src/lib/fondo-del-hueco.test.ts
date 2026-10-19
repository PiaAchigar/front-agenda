import { describe, expect, it } from "vitest";
import { FONDO_DEL_HUECO, tipoDeHueco } from "./fondo-del-hueco";

describe("tipoDeHueco", () => {
  const base = { cerrado: false, noAtiende: false, pasado: false };

  it("sin nada especial, está libre", () => {
    expect(tipoDeHueco(base)).toBe("libre");
  });

  it("un horario que ya pasó, dentro del horario de la prestadora, es 'pasado'", () => {
    expect(tipoDeHueco({ ...base, pasado: true })).toBe("pasado");
  });

  it("'no atiende' gana sobre 'pasado': así se sigue viendo el horario de cada una", () => {
    expect(tipoDeHueco({ ...base, noAtiende: true, pasado: true })).toBe("no-atiende");
  });

  it("'cerrado' gana sobre todo", () => {
    expect(tipoDeHueco({ cerrado: true, noAtiende: true, pasado: true })).toBe("cerrado");
  });
});

describe("FONDO_DEL_HUECO", () => {
  it("'pasado' es blanco con punteado, no el beige de 'cerrado' ni el rayado de 'no atiende'", () => {
    const pasado = FONDO_DEL_HUECO.pasado;
    expect(pasado.className).toContain("bg-white");
    expect(pasado.className).not.toContain("bg-surface-high");
    expect(String(pasado.style?.backgroundImage)).toContain("radial-gradient");
    expect(pasado.style).not.toEqual(FONDO_DEL_HUECO["no-atiende"].style);
  });
});
