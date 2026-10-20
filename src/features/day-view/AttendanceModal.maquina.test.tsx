import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const VACIO: never[] = [];
const RESULTADO = { data: VACIO, isLoading: false, error: null };
const useClassRoster = vi.fn(() => RESULTADO);
vi.mock("../../api/agenda", () => ({
  useClassRoster: (...a: unknown[]) => (useClassRoster as (...x: unknown[]) => unknown)(...a),
  useMarkAttendance: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));

const { AttendanceModal } = await import("./AttendanceModal");

describe("AttendanceModal con máquina", () => {
  it("pide el roster con el machineId de la clase", () => {
    render(
      <AttendanceModal
        target={{ activityId: "a1", activityName: "Pilates", startsAt: "2020-01-01T13:00:00.000Z", machineId: "m1" }}
        onClose={() => {}}
      />,
    );
    expect(useClassRoster).toHaveBeenCalledWith("a1", "2020-01-01T13:00:00.000Z", "m1");
  });
});
