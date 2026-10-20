import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Anotada, ClassOccurrence } from "../../api/types";

let clases: ClassOccurrence[] = [];
vi.mock("../../api/agenda", () => ({
  useClasses: () => ({ data: clases, isLoading: false, error: null }),
}));
const apiMock = vi.fn();
vi.mock("../../api/client", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

const { ClassesView } = await import("./ClassesView");

const anotada = (n: number, extra: Partial<Anotada> = {}): Anotada => ({
  appointmentId: `ap${n}`,
  customerId: `cu${n}`,
  nombre: `Clienta ${n}`,
  prueba: false,
  debe: 0,
  subscriptionId: `sub${n}`,
  compraId: null,
  ...extra,
});

const clase = (extra: Partial<ClassOccurrence> = {}): ClassOccurrence => ({
  occurrenceId: "oc1",
  date: "2099-01-01",
  scheduleId: "sch1",
  anotadas: [],
  kind: "activity",
  subjectId: "act1",
  sessionId: null,
  name: "Pilates",
  activityType: "class",
  sessionNumber: null,
  totalSessions: null,
  providerId: null,
  providerName: "Gabi",
  machineId: null,
  machineName: null,
  location: null,
  startTime: "10:00",
  endTime: "11:00",
  startsAt: "2099-01-01T13:00:00.000Z",
  capacity: 10,
  enrolledCount: 0,
  attendedCount: 0,
  ...extra,
});

function montar(props: Partial<Parameters<typeof ClassesView>[0]> = {}) {
  const onAnotar = vi.fn();
  const onCobrar = vi.fn();
  const onOpenAttendance = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ClassesView
        date="2099-01-01"
        onOpenAttendance={onOpenAttendance}
        onAnotar={onAnotar}
        onCobrar={onCobrar}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onAnotar, onCobrar, onOpenAttendance };
}

beforeEach(() => {
  apiMock.mockReset().mockResolvedValue({});
  vi.restoreAllMocks();
});

describe("anotadas en la card", () => {
  it("lista por nombre, con badge Prueba y botón Debe que cobra", async () => {
    const a = anotada(2, { debe: 5000, prueba: true });
    clases = [clase({ anotadas: [anotada(1), a], enrolledCount: 2 })];
    const { onCobrar } = montar();
    expect(screen.getByText("Clienta 1")).toBeInTheDocument();
    expect(screen.getByText("Prueba")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Debe \$5\.000/ }));
    expect(onCobrar).toHaveBeenCalledWith(clases[0], a);
  });

  it("con más de 6 muestra 6 y +N que despliega", async () => {
    clases = [clase({ anotadas: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => anotada(n)), enrolledCount: 8 })];
    montar();
    expect(screen.queryByText("Clienta 7")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+2" }));
    expect(screen.getByText("Clienta 8")).toBeInTheDocument();
  });
});

describe("sacar de la clase", () => {
  beforeEach(() => {
    clases = [clase({ anotadas: [anotada(1)], enrolledCount: 1 })];
  });

  it("confirma y cancela el turno", async () => {
    const confirm = vi.fn(() => true);
    window.confirm = confirm;
    montar();
    await userEvent.click(screen.getByLabelText("Sacar a Clienta 1 de esta clase"));
    expect(confirm).toHaveBeenCalledWith("¿Sacar a Clienta 1 de esta clase?");
    expect(apiMock).toHaveBeenCalledWith(
      "/api/agenda/appointments/ap1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),
    );
  });

  it("si no acepta, no llama nada", async () => {
    window.confirm = vi.fn(() => false);
    montar();
    await userEvent.click(screen.getByLabelText("Sacar a Clienta 1 de esta clase"));
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("no aparece en una clase que ya pasó", () => {
    clases = [clase({ anotadas: [anotada(1)], startsAt: "2020-01-01T13:00:00.000Z" })];
    montar();
    expect(screen.queryByLabelText("Sacar a Clienta 1 de esta clase")).not.toBeInTheDocument();
  });
});

describe("botón Anotar", () => {
  it("llama onAnotar", async () => {
    clases = [clase()];
    const { onAnotar } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Anotar" }));
    expect(onAnotar).toHaveBeenCalledWith(clases[0]);
  });

  it("deshabilitado si la clase ya pasó", () => {
    clases = [clase({ startsAt: "2020-01-01T13:00:00.000Z" })];
    montar();
    const b = screen.getByRole("button", { name: "Anotar" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("title", "La clase ya pasó");
  });

  it("deshabilitado si está llena", () => {
    clases = [clase({ capacity: 2, enrolledCount: 2 })];
    montar();
    const b = screen.getByRole("button", { name: "Anotar" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("title", "La clase está llena");
  });
});
