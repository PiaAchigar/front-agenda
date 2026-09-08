import { describe, expect, it } from "vitest";
import { descripcionDeFaltante, hayQueAvisar } from "./aviso-insumos";
import type { Consumo } from "../api/types";

const vacio: Consumo = { descontados: 0, faltantes: [], omitidos: [] };
const faltante = {
  productId: "g",
  name: "Guantes de nitrilo",
  quantity: 2,
  stockAntes: 1,
  stockDespues: -1,
};

describe("hayQueAvisar", () => {
  it("sin consumo no avisa", () => {
    // Volver a completar un turno ya completado no trae `consumo`.
    expect(hayQueAvisar(undefined)).toBe(false);
  });

  it("un descuento que salió bien no avisa", () => {
    // Si abriera un modal cada vez que se completa un turno, Laura aprendería
    // a cerrarlo sin leerlo y el aviso dejaría de servir.
    expect(hayQueAvisar({ ...vacio, descontados: 3 })).toBe(false);
  });

  it("avisa cuando un insumo quedó en negativo", () => {
    expect(hayQueAvisar({ ...vacio, descontados: 1, faltantes: [faltante] })).toBe(true);
  });

  it("un insumo archivado solo no abre el modal", () => {
    // Es un problema de configuración de la receta, no algo que haya que
    // resolver en el momento de completar el turno.
    expect(
      hayQueAvisar({
        ...vacio,
        descontados: 1,
        omitidos: [{ productId: "a", name: "Ampolla", motivo: "archivado" }],
      }),
    ).toBe(false);
  });
});

describe("descripcionDeFaltante", () => {
  it("dice cuánto quedó y cuánto había", () => {
    expect(descripcionDeFaltante(faltante)).toBe("quedó en -1, tenía 1 y se usaron 2");
  });

  it("cuando nadie lo había contado, lo dice en vez de inventar un 0", () => {
    // "tenía 0" sería mentira: nadie lo contó. La diferencia importa porque el
    // arreglo es distinto — cargar el stock, no comprar más.
    expect(descripcionDeFaltante({ ...faltante, stockAntes: null })).toBe(
      "quedó en -1 y no tenía stock cargado",
    );
  });

  it("muestra las fracciones tal cual", () => {
    expect(
      descripcionDeFaltante({ ...faltante, quantity: 0.5, stockAntes: 0, stockDespues: -0.5 }),
    ).toBe("quedó en -0.5, tenía 0 y se usaron 0.5");
  });
});
