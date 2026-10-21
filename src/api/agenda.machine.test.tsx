import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const apiMock = vi.fn().mockResolvedValue({ success: true, data: [] });
vi.mock("./client", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

const { useClassRoster, useMarkAttendance } = await import("./agenda");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("useClassRoster con machineId", () => {
  it("lo manda en la URL", async () => {
    renderHook(() => useClassRoster("a1", "2020-01-01T13:00:00.000Z", "m1"), { wrapper });
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0]![0]).toContain("&machineId=m1");
  });
});

describe("useClassRoster con providerId", () => {
  it("lo manda en la URL", async () => {
    apiMock.mockClear();
    renderHook(() => useClassRoster("a1", "2020-01-02T13:00:00.000Z", null, "p1"), { wrapper });
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0]![0]).toContain("&providerId=p1");
  });

  it("sin proveedora no manda el parámetro", async () => {
    apiMock.mockClear();
    renderHook(() => useClassRoster("a1", "2020-01-03T13:00:00.000Z"), { wrapper });
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0]![0]).not.toContain("providerId");
  });
});

describe("useMarkAttendance — body del POST", () => {
  const base = { activityId: "a1", startsAt: "2020-01-01T13:00:00.000Z", entries: [] };
  const postBody = async (extra: object) => {
    apiMock.mockClear();
    const { result } = renderHook(() => useMarkAttendance(), { wrapper });
    await result.current.mutateAsync({ ...base, ...extra });
    return JSON.parse((apiMock.mock.calls[0]![1] as { body: string }).body);
  };

  it("con machineId y providerId null no manda ninguna de las dos claves", async () => {
    const body = await postBody({ machineId: null, providerId: null });
    expect(body).not.toHaveProperty("machineId");
    expect(body).not.toHaveProperty("providerId");
  });

  it("con valores manda las dos", async () => {
    const body = await postBody({ machineId: "m1", providerId: "p1" });
    expect(body.machineId).toBe("m1");
    expect(body.providerId).toBe("p1");
  });
});
