import { describe, expect, it } from "vitest";
import { ESTILO_DEBE } from "./estado-de-clase";

describe("estilo de Debe", () => {
  it("es la pastilla ámbar, la misma en el día, la semana, el mes y Referencias", () => {
    expect(ESTILO_DEBE).toContain("rounded-full");
    expect(ESTILO_DEBE).toContain("bg-amber-100");
    expect(ESTILO_DEBE).toContain("text-amber-800");
  });
});
