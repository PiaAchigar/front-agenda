import { describe, expect, it } from "vitest";
import { mesesParaAnotar } from "./meses-para-anotar";

describe("mesesParaAnotar", () => {
  it("antes del 25 sólo el mes de la clase", () => {
    expect(mesesParaAnotar("2026-11-24")).toEqual(["2026-11"]);
  });
  it("desde el 25 suma el mes siguiente", () => {
    expect(mesesParaAnotar("2026-11-25")).toEqual(["2026-11", "2026-12"]);
  });
  it("cruza de año", () => {
    expect(mesesParaAnotar("2026-12-31")).toEqual(["2026-12", "2027-01"]);
  });
});
