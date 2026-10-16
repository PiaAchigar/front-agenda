import { describe, expect, it } from "vitest";
import { primerDiaLibre } from "./primer-dia-libre";

describe("primerDiaLibre", () => {
  it("el primero desde hoy, sin importar el orden", () => {
    expect(primerDiaLibre(["2026-10-20", "2026-10-15", "2026-10-17"], "2026-10-16")).toBe("2026-10-17");
  });
  it("hoy cuenta", () => {
    expect(primerDiaLibre(["2026-10-16"], "2026-10-16")).toBe("2026-10-16");
  });
  it("sin días libres desde hoy: null", () => {
    expect(primerDiaLibre(["2026-10-01"], "2026-10-16")).toBeNull();
    expect(primerDiaLibre([], "2026-10-16")).toBeNull();
  });
});
