import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVISO_HORARIO_PASADO } from "../../lib/horario";

const h = vi.hoisted(() => ({
  dias: [] as string[],
  slots: [] as string[],
  /** Si está, los huecos dependen de la prestadora. */
  porPrestadora: null as Record<string, string[]> | null,
  /** Si está, los días libres dependen del mes (y un mes que no está, no tiene ninguno). */
  porMes: null as Record<string, string[]> | null,
  mesesPedidos: [] as string[],
}));

vi.mock("../../api/agenda", () => ({
  useMonthAvailability: (_s: unknown, _p: unknown, month: string) => {
    if (!h.mesesPedidos.includes(month)) h.mesesPedidos.push(month);
    return {
      data: { month, availableDays: h.porMes ? (h.porMes[month] ?? []) : h.dias },
      isFetching: false,
    };
  },
  useAvailability: (serviceId: string | null, date: string | null, opts?: { providerId?: string }) => ({
    data: date
      ? { date, serviceId, durationMinutes: 30, slots: (h.porPrestadora?.[opts?.providerId ?? ""] ?? h.slots).map((start) => ({ start, end: start, options: [] })) }
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
  h.porPrestadora = null;
  h.porMes = null;
  h.mesesPedidos = [];
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

  it("elegirPrimerDiaLibre: si el mes no tiene lugar, sigue buscando en los meses siguientes", () => {
    // Octubre sólo tiene un día que ya pasó; noviembre, nada; diciembre, el 3.
    h.porMes = { "2026-10": ["2026-10-10"], "2026-12": ["2026-12-03", "2026-12-09"] };
    const props = montar({ fecha: "", elegirPrimerDiaLibre: true });

    expect(props.onCambiarFecha).toHaveBeenCalledTimes(1);
    expect(props.onCambiarFecha).toHaveBeenCalledWith("2026-12-03");
    // El calendario queda mostrando el mes del día elegido.
    expect(screen.getByText(/diciembre/i)).toBeInTheDocument();
    expect(h.mesesPedidos).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("elegirPrimerDiaLibre: busca hasta 6 meses y, si no hay lugar, lo dice", () => {
    h.porMes = {};
    const props = montar({ fecha: "", elegirPrimerDiaLibre: true });

    expect(props.onCambiarFecha).not.toHaveBeenCalled();
    expect(h.mesesPedidos).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
    expect(
      screen.getByText("No hay días libres en los próximos 6 meses para este servicio con esta prestadora."),
    ).toBeInTheDocument();
  });

  it("elegirPrimerDiaLibre: al cambiar de prestadora sin haber encontrado lugar, vuelve a buscar desde el principio", () => {
    h.porMes = {};
    const props: Props = {
      serviceId: "svc", providerId: "prov", fecha: "", hora: "", horaLibre: false,
      elegirPrimerDiaLibre: true, onCambiarFecha: vi.fn(), onCambiarHora: vi.fn(),
    };
    const { rerender } = render(<DiaYHoraDelTurno {...props} />);
    expect(screen.getByText(/No hay días libres en los próximos 6 meses/)).toBeInTheDocument();

    h.porMes = { "2026-10": ["2026-10-20"] };
    rerender(<DiaYHoraDelTurno {...props} providerId="otra" />);

    expect(props.onCambiarFecha).toHaveBeenCalledWith("2026-10-20");
    expect(screen.queryByText(/No hay días libres en los próximos/)).not.toBeInTheDocument();
    expect(screen.getByText(/octubre/i)).toBeInTheDocument();
  });

  it("sin elegirPrimerDiaLibre, un mes sin lugar no salta a otro", () => {
    h.porMes = {};
    montar({ fecha: "", elegirPrimerDiaLibre: false });

    expect(h.mesesPedidos).toEqual(["2026-10"]);
    expect(screen.queryByText(/No hay días libres en los próximos/)).not.toBeInTheDocument();
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

  it("A -> B (se limpia) -> A con la misma hora -> B otra vez: vuelve a limpiarla", () => {
    h.porPrestadora = { A: ["10:00", "11:00"], B: ["11:00"] };
    const onCambiarHora = vi.fn();
    const base: Props = {
      serviceId: "svc", providerId: "A", fecha: "2026-10-20", hora: "10:00",
      horaLibre: false, elegirPrimerDiaLibre: false, onCambiarFecha: vi.fn(), onCambiarHora,
    };
    const { rerender } = render(<DiaYHoraDelTurno {...base} />);
    expect(onCambiarHora).not.toHaveBeenCalled();

    rerender(<DiaYHoraDelTurno {...base} providerId="B" />); // 10:00 no está libre con B
    expect(onCambiarHora).toHaveBeenCalledTimes(1);

    rerender(<DiaYHoraDelTurno {...base} providerId="A" hora="" />);
    rerender(<DiaYHoraDelTurno {...base} providerId="A" hora="10:00" />); // la elige de nuevo, libre con A
    expect(onCambiarHora).toHaveBeenCalledTimes(1);

    rerender(<DiaYHoraDelTurno {...base} providerId="B" hora="10:00" />);
    expect(onCambiarHora).toHaveBeenCalledTimes(2);
    expect(onCambiarHora).toHaveBeenLastCalledWith("");
  });
});
