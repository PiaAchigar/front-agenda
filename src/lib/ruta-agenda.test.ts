import { describe, expect, it } from "vitest";
import { rutaConservando } from "./ruta-agenda";

describe("rutaConservando", () => {
  it("conserva todas las prestadoras y servicios repetidos y el día", () => {
    const url = new URL(
      "http://x" + rutaConservando("/dia", new URLSearchParams("prestadora=p1&prestadora=p2&servicio=s1&servicio=s2&date=d&otra=x")),
    );
    expect(url.searchParams.getAll("prestadora")).toEqual(["p1", "p2"]);
    expect(url.searchParams.getAll("servicio")).toEqual(["s1", "s2"]);
    expect(url.searchParams.get("date")).toBe("d");
    expect(url.searchParams.has("otra")).toBe(false);
  });

  it("ya no conserva `con`", () => {
    expect(rutaConservando("/dia", new URLSearchParams("con=p1"))).toBe("/dia");
  });

  it("los extra pisan a lo conservado", () => {
    expect(rutaConservando("/dia", new URLSearchParams("date=a"), { date: "b" })).toBe("/dia?date=b");
  });
});
