import { afterEach, describe, expect, it, vi } from "vitest";
import { destinoDeArranque, guardarRuta, rutaGuardada } from "./ruta-recordada";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("ruta recordada", () => {
  it("guarda y devuelve la pantalla", () => {
    guardarRuta("agenda:ruta", "/dia?date=2026-09-20");
    expect(rutaGuardada("agenda:ruta")).toBe("/dia?date=2026-09-20");
  });

  it("sin nada guardado devuelve null", () => {
    expect(rutaGuardada("agenda:ruta")).toBeNull();
  });

  it("si el navegador no deja leer el storage, no rompe", () => {
    // Modo privado, cookies bloqueadas: `sessionStorage` puede TIRAR al
    // tocarlo, no sólo venir vacío. Arrancar donde siempre es la salida
    // correcta; reventar la pantalla no.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(rutaGuardada("agenda:ruta")).toBeNull();
  });

  it("si no deja escribir, tampoco", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => guardarRuta("agenda:ruta", "/semana")).not.toThrow();
  });
});

describe("destinoDeArranque", () => {
  it("va a lo guardado", () => {
    expect(destinoDeArranque("/dia?date=2026-09-20", "/dia")).toBe("/dia?date=2026-09-20");
  });

  it("la primera vez, a la pantalla de siempre", () => {
    expect(destinoDeArranque(null, "/dia")).toBe("/dia");
  });

  it("nunca a la raíz: sería redirigirse a sí misma para siempre", () => {
    expect(destinoDeArranque("/", "/dia")).toBe("/dia");
  });
});
