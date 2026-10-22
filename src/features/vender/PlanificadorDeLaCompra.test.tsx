import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseDelPlanificador, ConsultaDeDisponibilidad, SesionPlanificable } from "../../api/planificador";
import type { Availability } from "../../api/types";

let base: BaseDelPlanificador;
let cerrados: string[] = []; // fechas sin atención
let ocupadaA: string[] = []; // fechas donde la hora de las 15:30 no tiene a nadie libre
let soloEn1530: Record<string, string[]> = {}; // serviceId → prestadoras libres a las 15:30
let con1615 = false; // agrega el hueco de las 16:15 con las dos prestadoras
let pidieron: ConsultaDeDisponibilidad[][] = [];
let enviados: Array<{ turnos: Array<Record<string, unknown>> }> = [];
let falla: (Error & { indice?: number }) | null = null;

vi.mock("../../api/planificador", () => ({
  useBasePlanificador: () => ({ data: base, isLoading: false, error: null }),
  useDisponibilidadEnLote: (consultas: ConsultaDeDisponibilidad[]) => {
    pidieron.push(consultas);
    const resultados: Availability[] = consultas.map((c) => {
      if (cerrados.includes(c.date)) return { date: c.date, serviceId: c.serviceId, durationMinutes: 30, slots: [], reason: "closed" };
      const libre = !ocupadaA.includes(c.date);
      return {
        date: c.date,
        serviceId: c.serviceId,
        durationMinutes: 30,
        slots: [
          { start: "15:30", end: "16:00", options: libre ? [{ providerId: "p1", providerName: "Tamara", machineId: null }, { providerId: "p2", providerName: "Gabi", machineId: null }].filter((o) => !soloEn1530[c.serviceId] || soloEn1530[c.serviceId]!.includes(o.providerId)) : [] },
          ...(con1615 ? [{ start: "16:15", end: "16:45", options: [{ providerId: "p1", providerName: "Tamara", machineId: null }, { providerId: "p2", providerName: "Gabi", machineId: null }] }] : []),
          { start: "17:00", end: "17:30", options: [{ providerId: "p1", providerName: "Tamara", machineId: null }] },
        ],
      };
    });
    return { data: consultas.length ? { resultados } : undefined, isLoading: false };
  },
  useAgendarLote: () => ({
    isPending: false,
    mutate: (input: { turnos: Array<Record<string, unknown>> }, o: { onSuccess?: (r: unknown) => void; onError?: (e: Error) => void }) => {
      enviados.push(input);
      if (falla) o.onError?.(falla);
      else o.onSuccess?.({ turnos: input.turnos });
    },
  }),
}));

const { PlanificadorDeLaCompra } = await import("./PlanificadorDeLaCompra");

const sesion = (i: number, extra: Partial<SesionPlanificable> = {}): SesionPlanificable => ({
  purchaseServiceId: `ps${i}`,
  vuelta: i,
  orden: 1,
  nombre: "Piernas",
  serviceId: "svc-ancla",
  esDepilacion: true,
  zonas: ["piernas"],
  duracionMinutos: 30,
  juntos: false,
  ...extra,
});

function armarBase(n: number, o: Partial<BaseDelPlanificador> = {}): BaseDelPlanificador {
  return {
    compraId: "pu9",
    customerId: "cu1",
    clienta: "Sofía",
    descripcion: "Pack Piernas x6",
    intervalo: { dias: 30, cargado: true },
    venceEl: null,
    puerta: null,
    turnosDeLaClienta: [],
    sesiones: Array.from({ length: n }, (_, i) => sesion(i + 1)),
    ...o,
  };
}

function montar() {
  const onListo = vi.fn();
  render(
    <PlanificadorDeLaCompra
      compraId="pu9"
      customerName="Sofía"
      inicio={{ fecha: "2027-01-21", hora: "15:30", providerId: "p1", providerName: "Tamara" }}
      onListo={onListo}
    />,
  );
  return { onListo };
}

beforeEach(() => {
  base = armarBase(6);
  cerrados = [];
  ocupadaA = [];
  pidieron = [];
  soloEn1530 = {};
  con1615 = false;
  enviados = [];
  falla = null;
});

describe("PlanificadorDeLaCompra", () => {
  it("muestra el aviso de que no es obligatorio, con el nombre de la clienta", () => {
    montar();
    expect(
      screen.getByText('No hace falta agendar todo ahora. Lo que dejes sin agendar queda en la ficha de Sofía, en el CRM, como "A agendar", y lo agendás desde ahí cuando quieras.'),
    ).toBeInTheDocument();
  });

  it("'Una sesión cada' trae los días de la compra; sin cargar, dice 'Sugerido: este pack no tiene días cargados'", () => {
    base = armarBase(3, { intervalo: { dias: 21, cargado: true } });
    const { unmount } = render(
      <PlanificadorDeLaCompra compraId="pu9" customerName="Sofía" inicio={{ fecha: "2027-01-21", hora: "15:30", providerId: "p1" }} onListo={vi.fn()} />,
    );
    expect(screen.getByLabelText(/una sesión cada/i)).toHaveValue(21);
    expect(screen.queryByText(/este pack no tiene días cargados/i)).not.toBeInTheDocument();
    unmount();
    base = armarBase(3, { intervalo: { dias: 30, cargado: false } });
    montar();
    expect(screen.getByLabelText(/una sesión cada/i)).toHaveValue(30);
    expect(screen.getByText("Sugerido: este pack no tiene días cargados")).toBeInTheDocument();
  });

  it("una card por sesión, con fecha, hora, prestadora y Libre / Ocupada · libre desde HH:MM", () => {
    ocupadaA = ["2027-02-20"]; // sesión 2: 21/01 + 30 días
    montar();
    const cards = screen.getAllByTestId("card-sesion");
    expect(cards).toHaveLength(6);
    expect(within(cards[0]!).getByText("Sesión 1")).toBeInTheDocument();
    expect(within(cards[0]!).getByDisplayValue("2027-01-21")).toBeInTheDocument();
    expect(within(cards[0]!).getByDisplayValue("15:30")).toBeInTheDocument();
    expect(within(cards[0]!).getByRole("combobox")).toHaveDisplayValue(/tamara/i);
    expect(within(cards[0]!).getByText("Libre")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Ocupada · libre desde 17:00")).toBeInTheDocument();
  });

  it("un día cerrado corre la card al siguiente hábil y lo dice", () => {
    cerrados = ["2027-02-20", "2027-02-21"]; // sábado y domingo
    montar();
    const card2 = screen.getAllByTestId("card-sesion")[1]!;
    expect(within(card2).getByDisplayValue("2027-02-22")).toBeInTheDocument();
    expect(within(card2).getByText("se corrió al lunes")).toBeInTheDocument();
  });

  it("cambiar los días recalcula las no tocadas", async () => {
    const user = userEvent.setup();
    montar();
    const card3 = () => screen.getAllByTestId("card-sesion")[2]!;
    const card2 = () => screen.getAllByTestId("card-sesion")[1]!;
    fireEvent.change(within(card2()).getByLabelText(/fecha/i), { target: { value: "2027-02-25" } });
    await user.clear(screen.getByLabelText(/una sesión cada/i));
    await user.type(screen.getByLabelText(/una sesión cada/i), "7");
    expect(within(card2()).getByDisplayValue("2027-02-25")).toBeInTheDocument(); // tocada: no se mueve
    expect(within(card3()).getByDisplayValue("2027-02-04")).toBeInTheDocument(); // 21/01 + 14
  });

  it("'Agendar N sesiones' cuenta sólo las marcadas y habilitadas, y manda el lote en orden", async () => {
    const user = userEvent.setup();
    base = armarBase(6, { puerta: { total: 100000, pagado: 50000, minimo: 40000 } });
    montar();
    // 6 libres con 50% pago: la última no se puede (exige el total)
    const cards = screen.getAllByTestId("card-sesion");
    expect(within(cards[5]!).getByText("Se agenda cuando esté pago el total (faltan $50.000)")).toBeInTheDocument();
    await user.click(within(cards[2]!).getByRole("checkbox", { name: /agendar/i }));
    // al destildar una, la 6ª se habilita pero queda sin marcar
    expect(screen.getByRole("button", { name: "Agendar 4 sesiones" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agendar 4 sesiones" }));
    expect(enviados).toHaveLength(1);
    const turnos = enviados[0]!.turnos;
    expect(turnos.map((t) => t.customerPurchaseServiceId)).toEqual(["ps1", "ps2", "ps4", "ps5"]);
    expect(turnos[0]).toEqual({
      customerId: "cu1",
      serviceId: "svc-ancla",
      providerId: "p1",
      start: "2027-01-21T15:30:00-03:00",
      customerPurchaseServiceId: "ps1",
      zonas: ["piernas"],
    });
  });

  it("con 50% pago, desmarcar otra card no marca sola la última: queda habilitada pero sin marcar", async () => {
    const user = userEvent.setup();
    base = armarBase(6, { puerta: { total: 100000, pagado: 50000, minimo: 40000 } });
    montar();
    const cards = screen.getAllByTestId("card-sesion");
    await user.click(within(cards[2]!).getByRole("checkbox", { name: /agendar/i }));
    const ultima = within(cards[5]!).getByRole("checkbox", { name: /agendar/i });
    expect(ultima).toBeEnabled();
    expect(ultima).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Agendar 4 sesiones" })).toBeInTheDocument();
    await user.click(ultima);
    expect(screen.getByRole("button", { name: "Agendar 5 sesiones" })).toBeInTheDocument();
  });

  it("una compra sin 40% manda la card 1 como reserva de 24 h", async () => {
    const user = userEvent.setup();
    base = armarBase(3, { puerta: { total: 100000, pagado: 0, minimo: 40000 } });
    montar();
    expect(screen.getAllByText("Se agendan cuando esté pago el 40%")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Agendar 1 sesión" }));
    expect(enviados[0]!.turnos).toEqual([expect.objectContaining({ status: "reserved", expiryMinutes: 1440, customerPurchaseServiceId: "ps1" })]);
  });

  it("'Dejar todo para después' no manda nada y llama a onListo", async () => {
    const user = userEvent.setup();
    const { onListo } = montar();
    await user.click(screen.getByRole("button", { name: "Dejar todo para después" }));
    expect(enviados).toHaveLength(0);
    expect(onListo).toHaveBeenCalled();
  });

  it("un 409 con indice 1 pinta en rojo la card 2 con el motivo, y no cierra", async () => {
    const user = userEvent.setup();
    falla = Object.assign(new Error("Ese horario ya está ocupado"), { indice: 1 });
    const { onListo } = montar();
    await user.click(screen.getByRole("button", { name: "Agendar 6 sesiones" }));
    const cards = screen.getAllByTestId("card-sesion");
    expect(within(cards[1]!).getByText("Ese horario ya está ocupado")).toBeInTheDocument();
    expect(cards[1]!.className).toMatch(/red/);
    expect(within(cards[0]!).queryByText("Ese horario ya está ocupado")).not.toBeInTheDocument();
    expect(onListo).not.toHaveBeenCalled();
  });

  it("al terminar: 'Quedaron agendadas 5 sesiones. 1 queda \"A agendar\" en la ficha de Sofía.'", async () => {
    const user = userEvent.setup();
    const { onListo } = montar();
    await user.click(within(screen.getAllByTestId("card-sesion")[5]!).getByRole("checkbox", { name: /agendar/i }));
    await user.click(screen.getByRole("button", { name: "Agendar 5 sesiones" }));
    expect(screen.getByText('Quedaron agendadas 5 sesiones. 1 queda "A agendar" en la ficha de Sofía.')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Listo" }));
    expect(onListo).toHaveBeenCalled();
  });

  it("los combos 'juntos' se encadenan el mismo día y avisan la hora sin lugar exacto", () => {
    base = armarBase(0, {
      sesiones: [
        sesion(1, { esDepilacion: false, zonas: [], serviceId: "svcA", juntos: true, vuelta: 1, orden: 1, duracionMinutos: 45 }),
        sesion(2, { esDepilacion: false, zonas: [], serviceId: "svcB", juntos: true, vuelta: 1, orden: 2 }),
      ],
    });
    montar();
    const cards = screen.getAllByTestId("card-sesion");
    expect(within(cards[1]!).getByDisplayValue("16:15")).toBeInTheDocument();
    expect(within(cards[1]!).getByDisplayValue("2027-01-21")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Ocupada · libre desde 17:00")).toBeInTheDocument();
  });

  it("una card 'Ocupada' no se manda: no cuenta en 'Agendar N sesiones' y la card avisa", async () => {
    const user = userEvent.setup();
    ocupadaA = ["2027-02-20"]; // sesión 2
    montar();
    const cards = screen.getAllByTestId("card-sesion");
    expect(within(cards[1]!).getByText("Ocupada · libre desde 17:00")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("No se agenda hasta que elijas otro horario u otra prestadora")).toBeInTheDocument();
    expect(within(cards[0]!).queryByText(/no se agenda hasta/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agendar 5 sesiones" }));
    expect(enviados[0]!.turnos.map((t) => t.customerPurchaseServiceId)).toEqual(["ps1", "ps3", "ps4", "ps5", "ps6"]);
    expect(screen.getByText('Quedaron agendadas 5 sesiones. 1 queda "A agendar" en la ficha de Sofía.')).toBeInTheDocument();
  });

  it("'juntos': cada servicio encadenado prefiere la prestadora que salió para el anterior de su vuelta", () => {
    con1615 = true;
    soloEn1530 = { svcA: ["p2"] }; // el 1º sólo tiene a Gabi (p2) a las 15:30; el hueco pedido es de Tamara (p1)
    base = armarBase(0, {
      sesiones: [
        sesion(1, { esDepilacion: false, zonas: [], serviceId: "svcA", juntos: true, vuelta: 1, orden: 1, duracionMinutos: 45 }),
        sesion(2, { esDepilacion: false, zonas: [], serviceId: "svcB", juntos: true, vuelta: 1, orden: 2 }),
      ],
    });
    montar();
    const cards = screen.getAllByTestId("card-sesion");
    expect(within(cards[0]!).getByRole("combobox")).toHaveDisplayValue(/gabi/i);
    expect(within(cards[1]!).getByRole("combobox")).toHaveDisplayValue(/gabi/i);
  });
});
