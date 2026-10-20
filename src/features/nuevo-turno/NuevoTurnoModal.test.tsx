import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosParaAgendar } from "../../api/types";
import type { Catalogo, Compra, ItemDeCatalogo } from "../../api/ventas";

const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", phone: null, email: null, creditBalance: "0" };
const OTRA = { id: "cu2", name: "Ana Paz", dni: "1", phone: null, email: null, creditBalance: null };
const EST = { id: "a-est", nombre: "Estética" };
const DEPI = { id: "a-depi", nombre: "Depilación Definitiva" };
const ACT = { id: "a-act", nombre: "Actividades" };
const CAP = { id: "a-cap", nombre: "Capacitaciones" };
const it_ = (p: Partial<ItemDeCatalogo> & Pick<ItemDeCatalogo, "origen" | "id" | "nombre">): ItemDeCatalogo => ({
  packSesiones: null, packDescuentoPct: null, precioDesde: 10000, descripcion: null, desglose: [], area: null, ...p,
});
const CATALOGO: Catalogo = {
  servicios: [
    it_({ origen: "servicio", id: "s1", nombre: "Limpieza facial", area: EST }),
    it_({ origen: "servicio", id: "s-act", nombre: "Yoga", area: ACT }),
  ],
  combos: [
    it_({ origen: "combo", id: "c1", nombre: "Pack Glow x4", area: EST, packSesiones: 4 }),
    it_({ origen: "combo", id: "c-cap", nombre: "Taller", area: CAP }),
  ],
  depilacion: [it_({ origen: "depilacion", id: "d1", nombre: "Piernas", area: DEPI, packSesiones: 6 })],
  capacitaciones: [],
  promociones: [
    { id: "pp", name: "Paquete Verano", discountPercentage: null, discountAmount: null, promotionType: "paquete", precioDelPaquete: 50000, destinos: [{ tipo: "servicio", id: "s1", cantidad: 1 }] },
  ],
};
const compra = (id: string, descripcion: string, comboId: string | null, lineas: Compra["servicios"], extra: Partial<Compra> = {}): Compra => ({
  id, description: descripcion, comboId, sessionsTotal: lineas.length, saldo: 0, servicios: lineas, ...extra,
});
const linea = (id: string, repeticion: number, extra: Partial<Compra["servicios"][number]> = {}): Compra["servicios"][number] => ({
  id, serviceId: "s1", depilationComboId: null, serviceName: "Limpieza facial", repeticion, estado: "disponible", ...extra,
});
const PACK_COMPRADO = compra("pu1", "Pack Glow x4", "c1", [linea("ps1", 1), linea("ps2", 2)], { sessionsTotal: 4 });
const DEPI_COMPRADA = compra("pu-depi", "Piernas", null, [linea("ps-depi", 1, { serviceId: null, depilationComboId: "d1", serviceName: null })], {
  depilationComboId: "d1", sessionsTotal: 6,
});
const COTIZACION = {
  description: "Pack Glow x4", sessionsTotal: 4, baseAmount: 40000, discountedAmount: 40000, finalAmount: 40000,
  promotionId: null, expiresAt: null, comboId: "c1", depilationComboId: null, serviceId: null, trainingId: null,
};
const DATOS_DEPI: DatosParaAgendar = {
  nombreDelPack: "Piernas", sesion: 1, sesionesTotales: 6, presupuestoMinutos: 60, zonasDeRegalo: 0, sexo: "mujer",
  zonas: [{ id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 9, esDeRegalo: false, disponible: true, motivo: null }],
  puerta: { puedeAgendar: true, puedeReservar: true, motivo: "", faltaCobrar: 0 },
  serviceId: "svc-ancla",
};

let errorDeCatalogo: Error | null = null;
let comprasPorClienta: Record<string, Compra[]> = {};
let clientaPrefill: typeof CLIENTA | undefined;
const vender = vi.fn((_i: unknown, o?: { onSuccess?: (r: unknown) => void }) => {
  comprasPorClienta = {
    ...comprasPorClienta,
    cu1: [...(comprasPorClienta.cu1 ?? []), compra("pu9", "Pack Glow x4", "c1", [linea("ps9", 1)], { sessionsTotal: 4 })],
  };
  o?.onSuccess?.({ id: "pu9" });
});
const despues = vi.fn();
const crear = vi.fn();

vi.mock("../../api/ventas", () => ({
  useCatalogoVendible: () => (errorDeCatalogo ? { data: undefined, isLoading: false, error: errorDeCatalogo } : { data: CATALOGO, isLoading: false, error: null }),
  useComprasDeCliente: (id: string | null) => ({ data: id ? (comprasPorClienta[id] ?? []) : undefined, isLoading: false }),
  useCotizacion: (p: unknown) => (p ? { data: COTIZACION, isFetching: false, error: null } : { data: undefined, isFetching: false, error: null }),
  useVender: () => ({ mutate: vender, isPending: false, error: null }),
}));
vi.mock("../../api/agenda", () => ({
  useComboPendientes: () => ({ data: undefined, isSuccess: false, isError: false }),
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useCustomer: () => ({ data: clientaPrefill }),
  useCustomerSearch: (q: string) => ({ data: q ? [CLIENTA, OTRA] : [], isFetching: false }),
  useParaAgendar: (id: string | null) => ({ data: id ? DATOS_DEPI : undefined, isFetching: false }),
  useProvidersByService: (s: string | null) => ({ data: s ? [{ id: "prov1", fullName: "Gabi", specialties: null }] : [], isFetching: false }),
  useServices: () => ({ data: [{ id: "s1", name: "Limpieza facial", estimatedDurationMinutes: 30 }] }),
  useServicesByProvider: () => ({ data: [{ id: "s1" }], isFetching: false, isError: false }),
  useAvailability: () => ({ data: undefined, isFetching: false, isLoading: false }),
  useMonthAvailability: () => ({ data: undefined, isFetching: false }),
}));
vi.mock("../vender/DespuesDeVender", () => ({
  DespuesDeVender: (props: { onAgendar: (t: unknown) => void; cobrarAhora?: boolean }) => {
    despues(props);
    return (
      <div>
        DESPUES DE VENDER
        <button onClick={() => props.onAgendar({
          date: "2027-01-20",
          prefill: { customerId: "cu1", serviceId: "s1", compraPreferidaId: "pu9", minutes: 930, providerId: "prov1", providerName: "Gabi" },
        })}>simular agendar</button>
      </div>
    );
  },
}));

const { NuevoTurnoModal } = await import("./NuevoTurnoModal");

beforeEach(() => {
  comprasPorClienta = {};
  errorDeCatalogo = null;
  clientaPrefill = undefined;
  vender.mockClear();
  despues.mockClear();
  crear.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-16T12:30:00Z"));
});
afterEach(() => vi.useRealTimers());

const HUECO = { providerId: "prov1", providerName: "Gabi", minutes: 930 };
function montar(prefill: Parameters<typeof NuevoTurnoModal>[0]["prefill"] = HUECO) {
  const onClose = vi.fn();
  render(<NuevoTurnoModal date="2027-01-20" prefill={prefill} onClose={onClose} />);
  return { onClose, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
}
type U = ReturnType<typeof userEvent.setup>;
async function elegirClienta(user: U) {
  await user.type(screen.getByPlaceholderText(/nombre, dni/i), "an");
  await user.click(await screen.findByText(/Sofía Herrera/));
}
const grupos = () => Array.from(screen.getByLabelText("Qué").querySelectorAll("optgroup")).map((g) => g.label);

describe("NuevoTurnoModal — la forma", () => {
  it("no tiene solapas y los campos van en orden: Día, Hora, Clienta, Área, Qué", () => {
    montar();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    const campos = [screen.getByLabelText("Día"), screen.getByLabelText("Hora"), screen.getByText("Cliente"), screen.getByLabelText("Área"), screen.getByLabelText("Qué")];
    campos.slice(1).forEach((c, i) => {
      expect(campos[i]!.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.getByLabelText("Día")).toHaveValue("2027-01-20");
    expect(screen.getByLabelText("Hora")).toHaveValue("15:30");
  });

  it("tiene alto fijo", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Nuevo turno" }).parentElement!.parentElement!).toHaveClass("h-[90vh]");
  });

  it("el Área no ofrece Actividades ni Capacitaciones y sí Promos", () => {
    montar();
    const opciones = within(screen.getByLabelText("Área")).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Elegí un área…", "Depilación Definitiva", "Estética", "Promos"]);
  });

  it("un hueco con horario pasado avisa", async () => {
    const { user } = montar();
    fireEvent.change(screen.getByLabelText("Día"), { target: { value: "2026-10-16" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "08:00" } });
    expect(screen.getByText(/ese horario ya pasó/i)).toBeInTheDocument();
    expect(user).toBeTruthy();
  });
});

describe("NuevoTurnoModal — Qué y cuándo se cobra", () => {
  it("con clienta que tiene un pack, 'Ya comprado' va arriba; elegirlo agenda sin cobrar", async () => {
    comprasPorClienta = { cu1: [PACK_COMPRADO] };
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    expect(grupos()[0]).toBe("Ya comprado");
    await user.selectOptions(screen.getByLabelText("Qué"), "comprado:ps1");
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
    expect(screen.queryByText("¿Cuándo se cobra?")).not.toBeInTheDocument();
  });

  it("sin clienta no hay 'Ya comprado'", async () => {
    comprasPorClienta = { cu1: [PACK_COMPRADO] };
    const { user } = montar();
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    expect(grupos()).not.toContain("Ya comprado");
  });

  it("un servicio nuevo pregunta cuándo se cobra: 'En el turno' por defecto agenda; 'Ahora' vende", async () => {
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    expect(screen.getByText("¿Cuándo se cobra?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "En el turno" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Ahora" }));
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeInTheDocument();
  });

  it("un pack nuevo vende y agenda; 'En el turno' no pasa por el cobro y agenda con la compra nueva elegida", async () => {
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    await user.click(screen.getByRole("button", { name: "Vender y agendar" }));
    expect(await screen.findByText("DESPUES DE VENDER")).toBeInTheDocument();
    expect(despues).toHaveBeenLastCalledWith(
      expect.objectContaining({ compraId: "pu9", cobrarAhora: false, fecha: "2027-01-20", hueco: { providerId: "prov1", providerName: "Gabi", minutes: 930 } }),
    );
    await user.click(screen.getByText("simular agendar"));
    // El mismo modal pasa a agendar con la línea nueva elegida en "Ya comprado".
    expect(screen.queryByText("DESPUES DE VENDER")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Qué")).toHaveValue("comprado:ps9");
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
  });

  it("con 'Ahora' el paso de cobro sí se ofrece", async () => {
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    await user.click(screen.getByRole("radio", { name: "Ahora" }));
    await user.click(screen.getByRole("button", { name: "Vender y agendar" }));
    expect(despues).toHaveBeenLastCalledWith(expect.objectContaining({ cobrarAhora: true }));
  });

  it("cerrar después de vender conserva el aviso de la ficha", async () => {
    const { user, onClose } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    await user.click(screen.getByRole("button", { name: "Vender y agendar" }));
    (despues.mock.lastCall![0] as { onCerrar: () => void }).onCerrar();
    expect(await screen.findByText(/La venta quedó en la ficha de Sofía Herrera/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("elegir abajo un pack que ya tiene sin usar avisa y ofrece agendar una de esas", async () => {
    comprasPorClienta = { cu1: [PACK_COMPRADO] };
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    expect(screen.getByText("Ya tiene este pack con 2 sesiones sin usar. ¿Agendar una de esas?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Pack Glow x4 · sesión 1 de 4/ }));
    expect(screen.getByLabelText("Qué")).toHaveValue("comprado:ps1");
    expect(screen.queryByText(/Ya tiene este pack/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
  });

  it("cambiar de Área vacía Qué y '¿Cuándo se cobra?'", async () => {
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    await user.click(screen.getByRole("radio", { name: "Ahora" }));
    await user.selectOptions(screen.getByLabelText("Área"), "promos");
    expect(screen.getByLabelText("Qué")).toHaveValue("");
    expect(screen.queryByText("¿Cuándo se cobra?")).not.toBeInTheDocument();
    // Y al volver a elegir algo, 'En el turno' otra vez por defecto.
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    expect(screen.getByRole("radio", { name: "En el turno" })).toBeChecked();
  });

  it("cambiar de clienta vacía Qué y '¿Cuándo se cobra?'", async () => {
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    await user.click(screen.getByLabelText("Cambiar cliente"));
    expect(screen.getByLabelText("Qué")).toHaveValue("");
    expect(screen.queryByText("¿Cuándo se cobra?")).not.toBeInTheDocument();
  });

  it("si el catálogo no carga, lo dice en vez de dejar el área vacía", () => {
    errorDeCatalogo = new Error("Forbidden");
    montar();
    expect(screen.getByText(/no se pudo cargar el catálogo: forbidden/i)).toBeInTheDocument();
  });

  it("con un horario que ya pasó avisa y no deja vender", async () => {
    vi.setSystemTime(new Date("2027-01-20T18:00:00Z")); // 15:00 ART
    const { user } = montar(); // hueco a las 15:30 del 2027-01-20
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "14:00" } });
    expect(screen.getByText("Ese horario ya pasó. Elegí uno a partir de ahora.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeDisabled();
  });

  it("las promos se venden como cualquier cosa nueva", async () => {
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "promos");
    await user.selectOptions(screen.getByLabelText("Qué"), "promo:pp");
    expect(screen.getByText("¿Cuándo se cobra?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeInTheDocument();
  });
});

describe("NuevoTurnoModal — depilación y precargas", () => {
  it("en Depilación no hay 'Servicios'; elegir una sesión comprada muestra las zonas", async () => {
    comprasPorClienta = { cu1: [DEPI_COMPRADA] };
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-depi");
    expect(grupos()).not.toContain("Servicios");
    expect(grupos()).toEqual(["Ya comprado", "Packs"]);
    await user.selectOptions(screen.getByLabelText("Qué"), "comprado:ps-depi");
    expect(screen.getByText("Pierna entera")).toBeInTheDocument();
  });

  it("'A agendar' del CRM con purchaseServiceId arranca con esa línea elegida", async () => {
    comprasPorClienta = { cu1: [PACK_COMPRADO, DEPI_COMPRADA] };
    clientaPrefill = CLIENTA;
    montar({ customerId: "cu1", purchaseServiceId: "ps-depi" });
    expect(await screen.findByText("Sofía Herrera")).toBeInTheDocument();
    expect(screen.getByLabelText("Área")).toHaveValue("a-depi");
    expect(screen.getByLabelText("Qué")).toHaveValue("comprado:ps-depi");
    expect(screen.getByText("Pierna entera")).toBeInTheDocument();
  });

  it("con serviceId arranca con el área de ese servicio y ese servicio", () => {
    montar({ serviceId: "s1", providerId: "prov1", providerName: "Gabi", minutes: 600 });
    expect(screen.getByLabelText("Área")).toHaveValue("a-est");
    expect(screen.getByLabelText("Qué")).toHaveValue("servicio:s1");
    expect(screen.getByLabelText("Hora")).toHaveValue("10:00");
  });

  it("la prestadora del hueco queda fija si hace el servicio", () => {
    montar({ serviceId: "s1", providerId: "prov1", providerName: "Gabi", minutes: 600 });
    const select = screen.getByRole("option", { name: "Gabi" }).parentElement as HTMLSelectElement;
    expect(select).toBeDisabled();
  });

  it("agendar crea el turno con el día y la hora del encabezado", async () => {
    const { user } = montar({ serviceId: "s1", providerId: "prov1", providerName: "Gabi", minutes: 600 });
    await elegirClienta(user);
    await user.click(screen.getByRole("button", { name: "Agendar" }));
    expect(crear.mock.calls[0]![0]).toMatchObject({
      customerId: "cu1", serviceId: "s1", providerId: "prov1", start: "2027-01-20T10:00:00-03:00",
    });
  });
});
