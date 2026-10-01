import { describe, expect, it } from "vitest";
import { disponibilidadDelMesUrl, disponibilidadUrl } from "./disponibilidad";

describe("disponibilidadUrl", () => {
  it("sin opciones es exactamente la URL de siempre", () => {
    expect(disponibilidadUrl("svc1", "2026-10-19")).toBe("/api/agenda/availability/svc1?date=2026-10-19");
  });

  it("suma proveedora y turno a ignorar sólo si vienen", () => {
    const url = disponibilidadUrl("svc1", "2026-10-19", { providerId: "p1", excludeAppointmentId: "a1" });
    expect(url).toBe("/api/agenda/availability/svc1?date=2026-10-19&providerId=p1&excludeAppointmentId=a1");
  });
});

describe("disponibilidadDelMesUrl", () => {
  it("arma la URL del mes", () => {
    expect(disponibilidadDelMesUrl("svc1", "p1", "2026-10")).toBe(
      "/api/agenda/availability/svc1/month?providerId=p1&month=2026-10",
    );
  });

  it("suma el turno a ignorar", () => {
    expect(disponibilidadDelMesUrl("svc1", "p1", "2026-10", "a1")).toBe(
      "/api/agenda/availability/svc1/month?providerId=p1&month=2026-10&excludeAppointmentId=a1",
    );
  });
});
