import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Compra, EstadoDeCobro } from "../../api/ventas";

let estado: { data?: EstadoDeCobro; error: Error | null; refetch: () => void } = { error: null, refetch: vi.fn() };
let compra: { data?: Compra | null; error: Error | null; refetch: () => void } = { error: null, refetch: vi.fn() };
let suyos: string[] = [];
let cargandoSuyos = false;

vi.mock("../../api/ventas", () => ({
  useEstadoDeCobro: () => estado,
  useCompraDeCliente: () => compra,
}));
vi.mock("../../api/agenda", () => ({
  useServicesByProvider: (id: string | null) => ({ data: cargandoSuyos ? undefined : id ? suyos.map((s) => ({ id: s, name: s })) : [], isFetching: false }),
}));
vi.mock("./CobrarPaso", () => ({
  CobrarPaso: ({ onCobrado, onDespues }: { onCobrado: (r: number) => void; onDespues: () => void }) => (
    <div>
      <button onClick={() => onCobrado(0)}>cobrar todo</button>
      <button onClick={() => onCobrado(30000)}>cobrar una parte</button>
      <button onClick={onDespues}>cobrar después</button>
    </div>
  ),
}));

const { DespuesDeVender } = await import("./DespuesDeVender");

const linea = (id: string, serviceId: string, serviceName: string) => ({ id, serviceId, depilationComboId: null, serviceName, estado: "disponible" as const });
const UNA = { id: "pu9", description: "Limpieza", saldo: 0, servicios: [linea("l1", "svc-limpieza", "Limpieza")] };
const DOS = { id: "pu9", description: "Combo Glow", saldo: 0, servicios: [linea("l1", "svc-limpieza", "Limpieza"), linea("l2", "svc-peeling", "Peeling")] };

function montar() {
  const onAgendar = vi.fn();
  const onCerrar = vi.fn();
  render(
    <DespuesDeVender compraId="pu9" customerId="cu1" customerName="Sofía" descripcion="Combo Glow" fecha="2027-01-21"
      hueco={{ providerId: "prov1", providerName: "Gabi", minutes: 930 }} onAgendar={onAgendar} onCerrar={onCerrar} />,
  );
  return { onAgendar, onCerrar };
}

beforeEach(() => {
  estado = { data: { pendiente: 50000, minimo: 20000, sugerido: 50000, faltaElMinimo: true }, error: null, refetch: vi.fn() };
  compra = { data: UNA, error: null, refetch: vi.fn() };
  suyos = ["svc-limpieza"];
  cargandoSuyos = false;
});

describe("DespuesDeVender", () => {
  it("si hay algo para cobrar, arranca en Cobrar", () => {
    montar();
    expect(screen.getByRole("button", { name: "cobrar todo" })).toBeInTheDocument();
  });

  it("si el saldo a favor cubrió todo, no hay Cobrar: pasa directo (y con una sola opción, traspasa)", () => {
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    const { onAgendar } = montar();
    expect(screen.queryByRole("button", { name: "cobrar todo" })).not.toBeInTheDocument();
    expect(onAgendar).toHaveBeenCalledWith({
      date: "2027-01-21",
      prefill: { customerId: "cu1", serviceId: "svc-limpieza", compraPreferidaId: "pu9", minutes: 930, providerId: "prov1", providerName: "Gabi" },
    });
  });

  it("'Cobrar después' avisa la deuda antes de seguir", async () => {
    const user = userEvent.setup();
    const { onAgendar } = montar();
    await user.click(screen.getByRole("button", { name: "cobrar después" }));
    expect(screen.getByText(/queda debiendo \$50\.000\. lo vas a ver en la ficha de la clienta/i)).toBeInTheDocument();
    expect(onAgendar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /seguir/i }));
    expect(onAgendar).toHaveBeenCalled();
  });

  it("un pago parcial también avisa lo que queda debiendo", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "cobrar una parte" }));
    expect(screen.getByText(/queda debiendo \$30\.000/i)).toBeInTheDocument();
  });

  it("con varias opciones, pregunta qué va y preselecciona la que hace la profesional", async () => {
    const user = userEvent.setup();
    compra = { ...compra, data: DOS };
    const { onAgendar } = montar();
    await user.click(screen.getByRole("button", { name: "cobrar todo" }));
    expect(screen.getByText(/qué va en este turno/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /limpieza/i })).toBeChecked();
    expect(screen.getByText(/gabi no hace este servicio/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /agendar/i }));
    expect(onAgendar).toHaveBeenCalledWith(expect.objectContaining({ prefill: expect.objectContaining({ serviceId: "svc-limpieza" }) }));
  });

  it("elegir uno que la profesional no hace abre Agendar sin profesional fija", async () => {
    const user = userEvent.setup();
    compra = { ...compra, data: DOS };
    const { onAgendar } = montar();
    await user.click(screen.getByRole("button", { name: "cobrar todo" }));
    await user.click(screen.getByRole("radio", { name: /peeling/i }));
    await user.click(screen.getByRole("button", { name: /agendar/i }));
    const { prefill } = onAgendar.mock.calls[0]![0];
    expect(prefill).toEqual({ customerId: "cu1", serviceId: "svc-peeling", compraPreferidaId: "pu9", minutes: 930 });
  });

  it("si no se puede leer el cobro, lo dice y deja reintentar", async () => {
    const user = userEvent.setup();
    estado = { data: undefined, error: new Error("Sin conexión"), refetch: vi.fn() };
    montar();
    expect(screen.getByText(/sin conexión/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(estado.refetch).toHaveBeenCalled();
  });

  it("una compra sin nada para agendar (p. ej. ya agendada) lo dice y deja cerrar", async () => {
    const user = userEvent.setup();
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    compra = { ...compra, data: { ...UNA, servicios: [] } };
    const { onCerrar, onAgendar } = montar();
    expect(screen.getByText(/no queda nada para agendar/i)).toBeInTheDocument();
    expect(onAgendar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it("mientras llegan los servicios de la profesional espera, y al llegar traspasa con ella", () => {
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    cargandoSuyos = true;
    const onAgendar = vi.fn();
    const el = () => (
      <DespuesDeVender compraId="pu9" customerId="cu1" customerName="Sofía" descripcion="Combo Glow" fecha="2027-01-21"
        hueco={{ providerId: "prov1", providerName: "Gabi", minutes: 930 }} onAgendar={onAgendar} onCerrar={vi.fn()} />
    );
    const { rerender } = render(el());
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(onAgendar).not.toHaveBeenCalled();
    cargandoSuyos = false;
    rerender(el());
    expect(onAgendar).toHaveBeenCalledWith({
      date: "2027-01-21",
      prefill: { customerId: "cu1", serviceId: "svc-limpieza", compraPreferidaId: "pu9", minutes: 930, providerId: "prov1", providerName: "Gabi" },
    });
  });
});
