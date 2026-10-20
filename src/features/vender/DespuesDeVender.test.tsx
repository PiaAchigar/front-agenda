import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Compra, EstadoDeCobro } from "../../api/ventas";

let estado: { data?: EstadoDeCobro; error: Error | null; refetch: () => void } = { error: null, refetch: vi.fn() };
let compra: { data?: Compra | null; error: Error | null; isSuccess?: boolean; refetch: () => void } = { error: null, refetch: vi.fn() };
let suyos: string[] = [];
let cargandoSuyos = false;
let errorSuyos = false;
let ancla: { data?: { serviceId: string }; isLoading: boolean; isError: boolean } = { isLoading: false, isError: false };
const pidioAncla: Array<string | null> = [];

vi.mock("../../api/ventas", () => ({
  useEstadoDeCobro: () => estado,
  useCompraDeCliente: () => compra,
}));
vi.mock("../../api/agenda", () => ({
  useServicesByProvider: (id: string | null) => ({
    data: cargandoSuyos || errorSuyos ? undefined : id ? suyos.map((s) => ({ id: s, name: s })) : [],
    isFetching: false,
    isError: errorSuyos,
  }),
  useParaAgendar: (id: string | null) => {
    pidioAncla.push(id);
    return id ? ancla : { data: undefined, isLoading: false, isError: false };
  },
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
  errorSuyos = false;
  ancla = { data: { serviceId: "svc-ancla" }, isLoading: false, isError: false };
  pidioAncla.length = 0;
});

const DEPI = { id: "pu9", description: "Pack Piernas x6", saldo: 0, servicios: [{ id: "d1", serviceId: null, depilationComboId: "dc1", serviceName: null, estado: "disponible" as const }] };

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

  it("depilación y la profesional del hueco no hace el servicio ancla: Agendar sin profesional fija", () => {
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    compra = { ...compra, data: DEPI };
    suyos = ["svc-limpieza"];
    const { onAgendar } = montar();
    expect(pidioAncla).toContain("d1");
    expect(onAgendar).toHaveBeenCalledWith({ date: "2027-01-21", prefill: { customerId: "cu1", purchaseServiceId: "d1", minutes: 930 } });
  });

  it("depilación y la profesional sí hace el ancla: queda fija", () => {
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    compra = { ...compra, data: DEPI };
    suyos = ["svc-ancla"];
    const { onAgendar } = montar();
    expect(onAgendar).toHaveBeenCalledWith({
      date: "2027-01-21",
      prefill: { customerId: "cu1", purchaseServiceId: "d1", minutes: 930, providerId: "prov1", providerName: "Gabi" },
    });
  });

  it("mientras llega el servicio ancla de la depilación espera (Cargando…, sin traspaso)", () => {
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    compra = { ...compra, data: DEPI };
    suyos = ["svc-ancla"];
    ancla = { data: undefined, isLoading: true, isError: false };
    const { onAgendar } = montar();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(onAgendar).not.toHaveBeenCalled();
  });

  it("si fallan los servicios de la profesional, sigue sin profesional fija en vez de quedar en Cargando…", () => {
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    errorSuyos = true;
    const { onAgendar } = montar();
    expect(onAgendar).toHaveBeenCalledWith({
      date: "2027-01-21",
      prefill: { customerId: "cu1", serviceId: "svc-limpieza", compraPreferidaId: "pu9", minutes: 930 },
    });
  });

  it("si la compra recién vendida todavía no aparece en la lista, lo dice y deja reintentar o cerrar", async () => {
    const user = userEvent.setup();
    estado = { ...estado, data: { pendiente: 0, minimo: 0, sugerido: 0, faltaElMinimo: false } };
    compra = { data: null, error: null, isSuccess: true, refetch: vi.fn() };
    const { onCerrar } = montar();
    expect(screen.getByText(/todavía no aparece la compra recién vendida/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(compra.refetch).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onCerrar).toHaveBeenCalled();
  });
});

describe("DespuesDeVender — cobrarAhora", () => {
  it("con cobrarAhora=false no hay paso de cobro: arranca en qué va en este turno", () => {
    compra = { data: DOS, error: null, refetch: vi.fn() };
    const onAgendar = vi.fn();
    render(
      <DespuesDeVender compraId="pu9" customerId="cu1" customerName="Sofía" descripcion="Combo Glow" fecha="2027-01-21"
        hueco={{ providerId: "prov1", providerName: "Gabi", minutes: 930 }} cobrarAhora={false} onAgendar={onAgendar} onCerrar={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /cobrar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "¿Qué va en este turno?" })).toBeInTheDocument();
  });
});
