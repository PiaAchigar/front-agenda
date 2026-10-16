import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVISO_HORARIO_PASADO } from "../../lib/horario";

const h = vi.hoisted(() => ({
  dias: [] as string[],
  slots: [] as string[],
}));

vi.mock("../../api/agenda", () => ({
  useMonthAvailability: (_s: unknown, _p: unknown, month: string) => ({
    data: { month, availableDays: h.dias },
    isFetching: false,
  }),
  useAvailability: (serviceId: string | null, date: string | null) => ({
    data: date
      ? { date, serviceId, durationMinutes: 30, slots: h.slots.map((start) => ({ start, end: start, options: [] })) }
      : undefined,
    isFetching: false,
    isLoading: false,
  }),
}));

const { DiaYHoraDelTurno } = await import("./DiaYHoraDelTurno");

type Props = Parameters<typeof DiaYHoraDelTurno>[0];
function montar(extra: Partial<Props> = {}) {
  const props: Props = {
    serviceId: "svc",
    providerId: "prov",
    fecha: "2026-10-16",
    hora: "",
    horaLibre: false,
    elegirPrimerDiaLibre: false,
    onCambiarFecha: vi.fn(),
    onCambiarHora: vi.fn(),
    ...extra,
  };
  render(<DiaYHoraDelTurno {...props} />);
  return props;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-16T12:30:00Z")); // 09:30 ART
  h.dias = ["2026-10-16", "2026-10-20"];
  h.slots = ["09:00", "10:00", "11:00"];
});
afterEach(() => {
  vi.useRealTimers();
});

describe("DiaYHoraDelTurno", () => {
  it("sin servicio o sin profesional: avisa y no muestra calendario", () => {
    montar({ providerId: null });
    expect(screen.getByText("Elegí servicio y prestadora para ver los días libres")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mes siguiente" })).not.toBeInTheDocument();
  });

  it("ofrece sólo los horarios que no pasaron", async () => {
    const props = montar();
    const select = screen.getByRole("combobox", { name: "Hora inicio" });
    const opciones = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(opciones).toEqual(["", "10:00", "11:00"]);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).selectOptions(select, "10:00");
    expect(props.onCambiarHora).toHaveBeenCalledWith("10:00");
  });

  it("hoy sin horarios que no hayan pasado: lo dice", () => {
    h.slots = ["09:00"];
    montar();
    expect(screen.getByText("No quedan horarios libres este día")).toBeInTheDocument();
  });

  it("clic en un día verde: cambia la fecha y limpia la hora", async () => {
    const props = montar();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "20" }));
    expect(props.onCambiarFecha).toHaveBeenCalledWith("2026-10-20");
    expect(props.onCambiarHora).toHaveBeenCalledWith("");
  });

  it("elegirPrimerDiaLibre sin fecha: elige el primer día libre una sola vez", () => {
    h.dias = ["2026-10-14", "2026-10-22", "2026-10-18"];
    const props = montar({ fecha: "", elegirPrimerDiaLibre: true });
    expect(props.onCambiarFecha).toHaveBeenCalledTimes(1);
    expect(props.onCambiarFecha).toHaveBeenCalledWith("2026-10-18");
  });

  it("horaLibre: input time y aviso si la hora ya pasó", () => {
    montar({ horaLibre: true, hora: "09:00" });
    const input = screen.getByLabelText("Hora inicio");
    expect(input).toHaveAttribute("type", "time");
    expect(screen.getByText(AVISO_HORARIO_PASADO)).toBeInTheDocument();
  });

  it("una hora que no está entre los huecos libres se limpia una vez y avisa", () => {
    h.slots = ["11:00"];
    const props = montar({ fecha: "2026-10-20", hora: "10:00" });
    expect(props.onCambiarHora).toHaveBeenCalledTimes(1);
    expect(props.onCambiarHora).toHaveBeenCalledWith("");
  });
});
