import { afterEach, describe, expect, it } from "vitest";
import { prefillDesdeUrl } from "./embed";

function conUrl(search: string) {
  window.history.pushState({}, "", `/dia${search}`);
}

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("prefillDesdeUrl", () => {
  it("una línea de depilación llega con purchaseServiceId, no serviceId", () => {
    conUrl("?embed=1&customerId=cu1&purchaseServiceId=cps-depi-1");
    expect(prefillDesdeUrl()).toEqual({ customerId: "cu1", purchaseServiceId: "cps-depi-1" });
  });

  it("un servicio normal sigue llegando con serviceId", () => {
    conUrl("?embed=1&customerId=cu1&serviceId=svc-full");
    expect(prefillDesdeUrl()).toEqual({ customerId: "cu1", serviceId: "svc-full" });
  });

  it("si vienen los dos, gana purchaseServiceId: es la línea, más específico que el servicio", () => {
    conUrl("?embed=1&customerId=cu1&serviceId=svc-full&purchaseServiceId=cps-depi-1");
    expect(prefillDesdeUrl()).toEqual({ customerId: "cu1", purchaseServiceId: "cps-depi-1" });
  });

  it("sin customerId no hay prefill que valga", () => {
    conUrl("?embed=1&serviceId=svc-full");
    expect(prefillDesdeUrl()).toBeNull();
  });

  it("sin nada en la URL, null", () => {
    conUrl("");
    expect(prefillDesdeUrl()).toBeNull();
  });
});
