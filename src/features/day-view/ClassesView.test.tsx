import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Anotada, ClassOccurrence } from "../../api/types";

let clases: ClassOccurrence[] = [];
vi.mock("../../api/agenda", () => ({
  useClasses: () => ({ data: clases, isLoading: false, error: null }),
}));
const apiMock = vi.fn();
vi.mock("../../api/client", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

const { ClassesView } = await import("./ClassesView");
const { COLOR_DE_TIPO } = await import("../../lib/estado-de-clase");

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

function montar(props: Partial<Parameters<typeof ClassesView>[0]> = {}, search = "") {
  const onAnotar = vi.fn();
  const onCobrar = vi.fn();
  const onOpenAttendance = vi.fn();
  render(
    <MemoryRouter initialEntries={[`/dia${search}`]}>
    <QueryClientProvider client={new QueryClient()}>
      <ClassesView
        date="2099-01-01"
        onOpenAttendance={onOpenAttendance}
        onAnotar={onAnotar}
        onCobrar={onCobrar}
        {...props}
      />
    </QueryClientProvider>
    </MemoryRouter>,
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

describe("color por tipo en la card", () => {
  it("la card y su insignia tienen el color de actividad o de capacitación", async () => {
    clases = [
      clase({ occurrenceId: "a1", name: "Pilates" }),
      clase({ occurrenceId: "c1", name: "Curso", kind: "training", subjectId: "t1", scheduleId: null }),
    ];
    montar();
    const act = (await screen.findByText("Pilates")).closest("li")!;
    const cap = screen.getByText("Curso").closest("li")!;
    expect(act.dataset.tipo).toBe("activity");
    expect(cap.dataset.tipo).toBe("training");
    expect(act.className).toContain(COLOR_DE_TIPO.activity.borde);
    expect(cap.className).toContain(COLOR_DE_TIPO.training.borde);
    expect(within(act).getByText("Actividad").className).toContain(COLOR_DE_TIPO.activity.insignia);
    expect(within(cap).getByText("Capacitación").className).toContain(COLOR_DE_TIPO.training.insignia);
  });
});

describe("sacar de la clase", () => {
  beforeEach(() => {
    clases = [clase({ anotadas: [anotada(1)], enrolledCount: 1 })];
  });

  it("pide confirmación en un modal y cancela el turno", async () => {
    montar();
    await userEvent.click(screen.getByLabelText("Sacar a Clienta 1 de esta clase"));
    const modal = screen.getByRole("dialog", { name: "Sacar de la clase" });
    expect(within(modal).getByText("¿Sacar a Clienta 1 de esta clase?")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
    await userEvent.click(within(modal).getByRole("button", { name: "Sacar" }));
    expect(apiMock).toHaveBeenCalledWith(
      "/api/agenda/appointments/ap1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("muestra el error en el modal si el PATCH falla", async () => {
    apiMock.mockRejectedValue(new Error("No se pudo sacar a la clienta"));
    montar();
    await userEvent.click(screen.getByLabelText("Sacar a Clienta 1 de esta clase"));
    const modal = screen.getByRole("dialog", { name: "Sacar de la clase" });
    await userEvent.click(within(modal).getByRole("button", { name: "Sacar" }));
    expect(await within(modal).findByText("No se pudo sacar a la clienta")).toBeInTheDocument();
  });

  it("con Cancelar cierra el modal y no llama nada", async () => {
    montar();
    await userEvent.click(screen.getByLabelText("Sacar a Clienta 1 de esta clase"));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

describe("filtro por búsqueda grupal", () => {
  it("con ?actividad=a muestra sólo las clases de a; una capacitación sin filtrar por ella se oculta", () => {
    clases = [
      clase({ occurrenceId: "o1", subjectId: "a", name: "Pilates" }),
      clase({ occurrenceId: "o2", subjectId: "b", name: "Yoga" }),
      clase({ occurrenceId: "o3", kind: "training", subjectId: "a", name: "Curso de masajes" }),
    ];
    montar({}, "?actividad=a");
    expect(screen.getByText("Pilates")).toBeInTheDocument();
    expect(screen.queryByText("Yoga")).not.toBeInTheDocument();
    expect(screen.queryByText("Curso de masajes")).not.toBeInTheDocument();
  });

  it("una capacitación elegida que no está en las listas igual se dibuja, sin filtro todo se ve", () => {
    clases = [
      clase({ occurrenceId: "o1", subjectId: "a", name: "Pilates" }),
      clase({ occurrenceId: "o3", kind: "training", subjectId: "zzz", name: "Curso raro" }),
    ];
    montar({}, "?capacitacion=zzz");
    expect(screen.getByText("Curso raro")).toBeInTheDocument();
    expect(screen.queryByText("Pilates")).not.toBeInTheDocument();
  });

  it("si hay filtros y no queda ninguna, lo avisa", () => {
    clases = [clase({ subjectId: "a" })];
    montar({}, "?actividad=otra");
    expect(screen.getByText("No hay clases de lo elegido este día.")).toBeInTheDocument();
  });
});

describe("dar de baja de una capacitación", () => {
  beforeEach(() => {
    apiMock.mockReset();
    clases = [clase({ kind: "training", subjectId: "t1", activityType: null, anotadas: [anotada(1)], enrolledCount: 1 })];
  });

  // En una capacitación, sacar es siempre la baja de toda la capacitación (regla de Pia, 2026-10-21).
  it("la cruz abre la baja de la capacitación, no el sacar de una clase", async () => {
    apiMock.mockResolvedValue({ success: true, data: {
      compraId: "k1", empezo: false, precio: 100000, pagado: 0, encuentrosTotales: 3, encuentrosPasados: 0,
      vino: 0, falto: 0, corresponde: 0, sugerido: { saldoAFavor: 0, debe: 0 },
    } });
    montar();
    expect(screen.queryByLabelText("Sacar a Clienta 1 de esta clase")).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Dar de baja a Clienta 1 de la capacitación"));
    expect(await screen.findByRole("dialog", { name: "Dar de baja de la capacitación" })).toBeInTheDocument();
  });
});

