import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
let diasLibres: string[] = ["2027-01-20", "2027-01-22"];
let horariosLibres: string[] = ["09:00", "10:00", "11:00"];
let suyosCargando = false;
let comprasFetching = false;
let ventaTardia = false;
let compraDeLaVenta: Compra | null = null;
let comprasPorClienta: Record<string, Compra[]> = {};
let clientaPrefill: typeof CLIENTA | undefined;
type Oferta = { servicios: string[]; combos: string[]; depilacion: boolean; actividades: { id: string; nombre: string }[]; capacitaciones: { id: string; nombre: string }[] };
// null = la API no dijo nada: no se recorta (los tests de siempre siguen viendo todo).
let oferta: Oferta | null = null;
type Quien = { providerId: string; nombre: string; hace: string[]; serviceIds: string[]; todo: boolean };
let quienes: Quien[] = [];
let quienesDelArea: Quien[] | undefined = [];
// La oferta de cada prestadora, cuando un test necesita que difieran.
let ofertasPorId: Record<string, Oferta> = {};
// Qué prestadoras están libres en cada horario (los `options` de la disponibilidad).
let libresPorHora: Record<string, string[]> = {};
const vender = vi.fn((_i: unknown, o?: { onSuccess?: (r: unknown) => void }) => {
  compraDeLaVenta = compra("pu9", "Pack Glow x4", "c1", [linea("ps9", 1)], { sessionsTotal: 4 });
  if (ventaTardia) {
    // La lista cacheada todavía no la trae: se está volviendo a pedir.
    comprasFetching = true;
  } else {
    comprasPorClienta = { ...comprasPorClienta, cu1: [...(comprasPorClienta.cu1 ?? []), compraDeLaVenta] };
  }
  o?.onSuccess?.({ id: "pu9" });
});
const despues = vi.fn();
const crear = vi.fn();

vi.mock("../../api/ventas", () => ({
  useCatalogoVendible: () => (errorDeCatalogo ? { data: undefined, isLoading: false, error: errorDeCatalogo } : { data: CATALOGO, isLoading: false, error: null }),
  useComprasDeCliente: (id: string | null) => ({ data: id ? (comprasPorClienta[id] ?? []) : undefined, isLoading: false, isFetching: comprasFetching, isError: false }),
  useCotizacion: (p: unknown) => (p ? { data: COTIZACION, isFetching: false, error: null } : { data: undefined, isFetching: false, error: null }),
  useVender: () => ({ mutate: vender, isPending: false, error: null }),
}));
vi.mock("../../api/agenda", () => ({
  useComboPendientes: () => ({ data: undefined, isSuccess: false, isError: false }),
  useOfertaDeProveedora: (id: string | null) => ({ data: id ? (ofertasPorId[id] ?? oferta ?? undefined) : undefined, isLoading: false, isError: false }),
  useProviders: () => ({ data: [{ id: "prov1", fullName: "Gabi", specialties: null }, { id: "prov2", fullName: "Lu", specialties: null }] }),
  useQuienHace: (que: unknown) => ({ data: que ? quienes : undefined, isLoading: false }),
  useQuienHaceEn: (lista: unknown) => ({ data: lista ? quienesDelArea : undefined, isLoading: false }),
  useDisponibilidades: (ids: string[], date: string | null) =>
    Object.keys(libresPorHora).length === 0 ? new Map() : new Map(ids.map((id) => [id, { date, serviceId: id, durationMinutes: 30, slots: Object.entries(libresPorHora).map(([start, ps]) => ({ start, end: start, options: ps.map((p) => ({ providerId: p, providerName: p, machineId: null })) })) }])),
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useCustomer: () => ({ data: clientaPrefill }),
  useCustomerSearch: (q: string) => ({ data: q ? [CLIENTA, OTRA] : [], isFetching: false }),
  useParaAgendar: (id: string | null) => ({ data: id ? DATOS_DEPI : undefined, isFetching: false }),
  useProvidersByService: (s: string | null) => ({ data: s ? [{ id: "prov1", fullName: "Gabi", specialties: null }] : [], isFetching: false }),
  useServices: () => ({ data: [{ id: "s1", name: "Limpieza facial", estimatedDurationMinutes: 30 }] }),
  useServicesByProvider: (id: string | null) => ({
    data: id && !suyosCargando ? [{ id: "s1" }] : undefined, isFetching: false, isError: false, isLoading: !!id && suyosCargando,
  }),
  useAvailability: (serviceId: string | null, date: string | null) => ({
    data: date
      ? { date, serviceId, durationMinutes: 30, slots: horariosLibres.map((start) => ({ start, end: start, options: (libresPorHora[start] ?? []).map((p) => ({ providerId: p, providerName: p, machineId: null })) })) }
      : undefined,
    isFetching: false,
    isLoading: false,
  }),
  useMonthAvailability: (_s: unknown, _p: unknown, month: string) => ({ data: { month, availableDays: diasLibres }, isFetching: false }),
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
  diasLibres = ["2027-01-20", "2027-01-22"];
  horariosLibres = ["09:00", "10:00", "11:00"];
  suyosCargando = false;
  comprasFetching = false;
  ventaTardia = false;
  compraDeLaVenta = null;
  clientaPrefill = undefined;
  oferta = null;
  quienes = [];
  quienesDelArea = [];
  ofertasPorId = {};
  libresPorHora = {};
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
  const onIrAGrupales = vi.fn();
  const el = <NuevoTurnoModal date="2027-01-20" prefill={prefill} onClose={onClose} onIrAGrupales={onIrAGrupales} />;
  const { rerender } = render(el);
  return { onClose, onIrAGrupales, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }), refrescar: () => rerender(<NuevoTurnoModal date="2027-01-20" prefill={prefill} onClose={onClose} />) };
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
    expect(select("Hora inicio").value).toBe("10:00");
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

  it("al elegir un servicio para agendar, el día y la hora los dibuja el cuerpo (calendario + horas libres), no el encabezado", async () => {
    const { user } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    expect(screen.queryByLabelText("Día")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hora")).not.toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Hora inicio" })).toBeInTheDocument();
    // Y vender sí usa los campos simples del encabezado.
    await user.click(screen.getByRole("radio", { name: "Ahora" }));
    expect(screen.getByLabelText("Día")).toHaveValue("2027-01-20");
    expect(screen.getByLabelText("Hora")).toBeInTheDocument();
  });
});

const select = (nombre: string) => screen.getByRole("combobox", { name: nombre }) as HTMLSelectElement;
const HUECO_S1 = { serviceId: "s1", providerId: "prov1", providerName: "Gabi", minutes: 600 };

describe("NuevoTurnoModal — día y hora de Agendar (calendario de días libres)", () => {
  it("desde un hueco arranca en ese día y hora, y crea el turno con el día elegido", async () => {
    const { user } = montar(HUECO_S1);
    await elegirClienta(user);
    expect(await screen.findByRole("button", { name: "20" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "22" }));
    expect(select("Hora inicio").value).toBe("");
    await user.selectOptions(select("Hora inicio"), "11:00");
    await user.click(screen.getByRole("button", { name: "Agendar" }));
    expect(crear.mock.calls[0]![0].start).toBe("2027-01-22T11:00:00-03:00");
  });

  it("sin hora elegida, Agendar está apagado y 'Hora fin' queda vacía", async () => {
    const { user } = montar({ ...HUECO_S1, minutes: undefined });
    await elegirClienta(user);
    expect(select("Hora inicio").value).toBe("");
    expect(screen.getByRole("button", { name: "Agendar" })).toBeDisabled();
    const horaFin = screen.getByText(/Hora fin/).parentElement!.querySelector("input") as HTMLInputElement;
    expect(horaFin.value).toBe("");
  });

  it("'A agendar' del CRM (sin hora) arranca en el primer día libre y sin hora", async () => {
    diasLibres = ["2026-10-22", "2026-10-25"]; // el primero libre es el 22
    clientaPrefill = CLIENTA;
    montar({ customerId: "cu1", serviceId: "s1" });
    expect(await screen.findByRole("button", { name: "22" })).toHaveAttribute("aria-pressed", "true");
    expect(select("Hora inicio").value).toBe("");
    expect(screen.getByRole("button", { name: "Agendar" })).toBeDisabled();
  });

  it("'A agendar' del CRM de un servicio ya comprado (sólo customerId + serviceId) elige la sesión comprada, no vende de nuevo", async () => {
    comprasPorClienta = { cu1: [PACK_COMPRADO] };
    clientaPrefill = CLIENTA;
    montar({ customerId: "cu1", serviceId: "s1" });
    expect(await screen.findByText("Sofía Herrera")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Qué")).toHaveValue("comprado:ps1"));
    expect(screen.queryByText(/cuándo se cobra/i)).not.toBeInTheDocument();
  });

  it("'A agendar' del CRM sin nada comprado de ese servicio cae al servicio del catálogo", async () => {
    comprasPorClienta = { cu1: [] };
    clientaPrefill = CLIENTA;
    montar({ customerId: "cu1", serviceId: "s1" });
    await waitFor(() => expect(screen.getByLabelText("Qué")).toHaveValue("servicio:s1"));
  });

  it("'Profesional: X' sólo aparece si esa profesional hace lo elegido", async () => {
    montar({ providerId: "prov1", providerName: "Gabi", minutes: 600 });
    expect(screen.queryByText(/Profesional: Gabi/)).not.toBeInTheDocument();
    montar({ serviceId: "s1", providerId: "prov1", providerName: "Gabi", minutes: 600 });
    expect(screen.getByText(/Profesional: Gabi/)).toBeInTheDocument();
  });

  it("la hora sólo ofrece horarios libres", async () => {
    horariosLibres = ["10:00", "11:00"];
    montar(HUECO_S1);
    const horas = Array.from(select("Hora inicio").options).map((o) => o.value).filter(Boolean);
    expect(horas).toEqual(["10:00", "11:00"]);
  });

  it("una hora del hueco que no está libre se descarta, avisa y apaga Agendar", async () => {
    horariosLibres = ["11:00"];
    montar(HUECO_S1);
    expect(await screen.findByText("El horario 10:00 no está libre con esta prestadora. Elegí otro.")).toBeInTheDocument();
    expect(select("Hora inicio").value).toBe("");
    expect(screen.getByRole("button", { name: "Agendar" })).toBeDisabled();
  });

  it("una hora del hueco que sí está libre se conserva y deja agendar", async () => {
    horariosLibres = ["10:00", "11:00"];
    const { user } = montar(HUECO_S1);
    await elegirClienta(user);
    expect(select("Hora inicio").value).toBe("10:00");
    expect(screen.getByRole("button", { name: "Agendar" })).toBeEnabled();
  });

  it("depilación con una hora pasada: avisa y apaga Agendar y Reservar 24 h", async () => {
    diasLibres = ["2026-10-16", "2026-10-20"]; // hoy es 16/10, 09:30
    comprasPorClienta = { cu1: [DEPI_COMPRADA] };
    clientaPrefill = CLIENTA;
    montar({ customerId: "cu1", purchaseServiceId: "ps-depi" });
    await user_click_zona();
    expect(await screen.findByRole("button", { name: "16" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Hora inicio"), { target: { value: "09:00" } });
    expect(await screen.findByText("Ese horario ya pasó. Elegí uno a partir de ahora.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^agendar$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reservar 24 h/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Hora inicio"), { target: { value: "10:00" } });
    expect(screen.getByRole("button", { name: /reservar 24 h/i })).toBeEnabled();
  });
});

async function user_click_zona() {
  const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await u.click(await screen.findByRole("checkbox", { name: /pierna entera/i }));
}

describe("NuevoTurnoModal — lo que no se pierde", () => {
  it("la prestadora fija se resuelve antes de montar el cuerpo, y lo escrito sobrevive a un re-render", async () => {
    suyosCargando = true;
    const { user, refrescar } = montar(HUECO_S1);
    await elegirClienta(user);
    // Mientras no se sabe si la prestadora hace el servicio, el cuerpo no se monta.
    expect(screen.queryByPlaceholderText("Indicaciones especiales…")).not.toBeInTheDocument();
    suyosCargando = false;
    refrescar();
    const notas = await screen.findByPlaceholderText("Indicaciones especiales…");
    await user.type(notas, "viene con alergia");
    // La prestadora quedó fija desde el primer render del cuerpo y nada lo remonta.
    expect(screen.getByRole("option", { name: "Gabi" }).closest("select")).toBeDisabled();
    refrescar();
    expect(screen.getByPlaceholderText("Indicaciones especiales…")).toHaveValue("viene con alergia");
  });

  it("después de vender, si la lista de compras todavía no trae la nueva, espera y la elige cuando aparece", async () => {
    ventaTardia = true;
    const { user, refrescar } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    await user.click(screen.getByRole("button", { name: "Vender y agendar" }));
    await user.click(await screen.findByText("simular agendar"));
    expect(screen.getByLabelText("Qué")).toHaveValue("");
    // Llega la segunda lectura, ahora con la compra nueva.
    comprasPorClienta = { ...comprasPorClienta, cu1: [compraDeLaVenta!] };
    comprasFetching = false;
    refrescar();
    expect(screen.getByLabelText("Qué")).toHaveValue("comprado:ps9");
  });

  it("si la lista ya no está en camino y la línea no aparece, suelta lo pendiente (no queda esperando)", async () => {
    ventaTardia = true;
    const { user, refrescar } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    await user.click(screen.getByRole("button", { name: "Vender y agendar" }));
    await user.click(await screen.findByText("simular agendar"));
    comprasFetching = false; // terminó de pedir y no está
    refrescar();
    expect(screen.getByLabelText("Qué")).toHaveValue("");
    comprasPorClienta = { ...comprasPorClienta, cu1: [compraDeLaVenta!] };
    refrescar();
    expect(screen.getByLabelText("Qué")).toHaveValue("");
  });

  it("elegir la clienta con el servicio del hueco puesto lo conserva, pero '¿Cuándo se cobra?' vuelve a 'En el turno'", async () => {
    const { user } = montar({ serviceId: "s1", providerId: "prov1", providerName: "Gabi", minutes: 600 });
    await user.click(screen.getByRole("radio", { name: "Ahora" }));
    await elegirClienta(user);
    expect(screen.getByLabelText("Qué")).toHaveValue("servicio:s1");
    expect(screen.getByRole("radio", { name: "En el turno" })).toBeChecked();
  });
});

describe("NuevoTurnoModal — desde el hueco de una prestadora", () => {
  const OFERTA_GABI: Oferta = {
    servicios: ["s1"], combos: [], depilacion: false,
    actividades: [{ id: "act-1", nombre: "Pilates" }], capacitaciones: [],
  };
  const areas = () => within(screen.getByLabelText("Área")).getAllByRole("option").map((o) => o.textContent);

  it("el desplegable Prestadora viene con la del hueco y Área sólo trae lo suyo", () => {
    oferta = OFERTA_GABI;
    montar();
    expect(screen.getByLabelText("Prestadora")).toHaveValue("prov1");
    expect(areas()).toEqual(["Elegí un área…", "Estética", "Promos", "Actividades que dicta"]);
  });

  it("Qué sólo trae sus servicios", async () => {
    oferta = OFERTA_GABI;
    const { user } = montar();
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    const opciones = within(screen.getByLabelText("Qué")).getAllByRole("option").map((o) => o.textContent);
    expect(opciones.some((o) => o?.startsWith("Limpieza facial"))).toBe(true);
    expect(opciones.some((o) => o?.startsWith("Pack Glow x4"))).toBe(false);
  });

  it("con 'Cualquiera' vuelve a todo el catálogo", async () => {
    oferta = OFERTA_GABI;
    const { user } = montar();
    await user.selectOptions(screen.getByLabelText("Prestadora"), "");
    expect(areas()).toEqual(["Elegí un área…", "Depilación Definitiva", "Estética", "Promos"]);
  });

  it("cambiar a una prestadora que no hace nada de esa Área la limpia", async () => {
    oferta = OFERTA_GABI;
    ofertasPorId = { prov2: { servicios: [], combos: [], depilacion: true, actividades: [], capacitaciones: [] } };
    quienesDelArea = undefined; // la lista del Área todavía no llegó: se ofrecen todas
    const { user } = montar();
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Prestadora"), "prov2");
    expect(screen.getByLabelText("Área")).toHaveValue("");
  });

  it("una actividad que dicta lleva a anotarla en Turnos grupales", async () => {
    oferta = OFERTA_GABI;
    const { user, onIrAGrupales, onClose } = montar();
    await user.selectOptions(screen.getByLabelText("Área"), "dicta-actividades");
    expect(screen.getByText(/se anotan desde Turnos grupales/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anotar en Pilates" }));
    expect(onIrAGrupales).toHaveBeenCalledWith("actividad", "act-1", "2027-01-20");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("NuevoTurnoModal — buscar desde el servicio (filtros cruzados)", () => {
  const SIN_COLUMNA = { minutes: 930 }; // el botón "Nuevo turno": sin prestadora
  const LU: Quien = { providerId: "prov2", nombre: "Lu", hace: ["Limpieza facial", "Masaje"], serviceIds: ["s1", "s2"], todo: true };
  const GABI: Quien = { providerId: "prov1", nombre: "Gabi", hace: ["Limpieza facial"], serviceIds: ["s1"], todo: false };
  const opciones = () => Array.from(select("Prestadora").options).map((o) => o.textContent);
  const gruposDe = () => Array.from(select("Prestadora").querySelectorAll("optgroup")).map((g) => g.label);

  it("sin columna arranca en 'Todas' y Área trae todo, con Promos", () => {
    montar(SIN_COLUMNA);
    expect(select("Prestadora").value).toBe("");
    expect(opciones()[0]).toBe("Todas");
    expect(within(screen.getByLabelText("Área")).getAllByRole("option").map((o) => o.textContent)).toContain("Promos");
  });

  it("elegido un combo, Prestadora lista quién lo hace: todo arriba, una parte con el detalle", async () => {
    quienes = [LU, GABI];
    const { user } = montar(SIN_COLUMNA);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    expect(opciones()).toEqual(["Todas (2 lo hacen)", "Lu", "Gabi — sólo Limpieza facial"]);
    expect(gruposDe()).toEqual(["Hacen todo", "Hacen una parte"]);
  });

  it("con la hora del turno, libres arriba y ocupadas con desde cuándo", async () => {
    quienes = [LU, GABI];
    libresPorHora = { "15:30": ["prov2"], "16:30": ["prov1"] };
    const { user } = montar(SIN_COLUMNA);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    expect(gruposDe()).toEqual(["Libres a las 15:30", "Ocupadas a esa hora"]);
    expect(opciones()).toContain("Gabi — sólo Limpieza facial · libre desde 16:30");
  });

  it("elegir la prestadora desde ahí no borra lo elegido", async () => {
    quienes = [LU, GABI];
    const { user } = montar(SIN_COLUMNA);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    await user.selectOptions(select("Prestadora"), "prov2");
    expect(screen.getByLabelText("Qué")).toHaveValue("combo:c1");
  });

  it("si una sola lo hace, queda elegida sola", async () => {
    quienes = [LU];
    const { user } = montar(SIN_COLUMNA);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "combo:c1");
    expect(select("Prestadora").value).toBe("prov2");
  });

  it("agendando un servicio con 'Todas', el desplegable del turno marca libres y ocupadas a esa hora", async () => {
    libresPorHora = { "10:00": ["prov1"] };
    montar({ serviceId: "s1", minutes: 600 });
    const turno = await screen.findByRole("combobox", { name: "Prestadora" });
    expect(Array.from(turno.querySelectorAll("optgroup")).map((g) => g.label)).toEqual(["Libres a las 10:00"]);
  });
});

describe("NuevoTurnoModal — el Área también filtra Prestadora", () => {
  const TAMARA: Quien = { providerId: "prov3", nombre: "Tamara", hace: ["Depilación Definitiva"], serviceIds: ["ancla"], todo: true };
  const opciones = () => Array.from(select("Prestadora").options).map((o) => o.textContent);

  it("elegida un Área (sin Qué), Prestadora lista a las que hacen algo de ahí", async () => {
    quienesDelArea = [TAMARA];
    const { user } = montar({ minutes: 930 });
    await user.selectOptions(screen.getByLabelText("Área"), "a-depi");
    expect(opciones()).toEqual(["Todas (1 en Depilación Definitiva)", "Tamara"]);
  });

  it("elegirla desde ahí deja el Área puesta", async () => {
    quienesDelArea = [TAMARA];
    const { user } = montar({ minutes: 930 });
    await user.selectOptions(screen.getByLabelText("Área"), "a-depi");
    await user.selectOptions(select("Prestadora"), "prov3");
    expect(screen.getByLabelText("Área")).toHaveValue("a-depi");
  });
});


describe("NuevoTurnoModal — la ayuda", () => {
  // Pedido de Pia (2026-10-22): un (?) en la esquina derecha del título, con
  // cómo cargar un turno, para la secretaria de Laura.
  afterEach(() => localStorage.clear());

  it("el ícono va en el renglón del título y abre la ayuda en lugar del formulario", async () => {
    const { user } = montar();
    const titulo = screen.getByRole("heading", { name: "Nuevo turno" });
    const boton = screen.getByRole("button", { name: "Cómo cargar un turno" });
    expect(titulo.parentElement).toContainElement(boton);

    await user.click(boton);

    expect(screen.getByRole("heading", { name: /Por prestadora/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /Por área o servicio/ })).toBeVisible();
    expect(screen.getByLabelText("Día")).not.toBeVisible();
    expect(boton).toHaveAttribute("aria-expanded", "true");
  });

  it("al volver, el formulario sigue con lo que tenía cargado", async () => {
    const { user } = montar();
    fireEvent.change(screen.getByLabelText("Día"), { target: { value: "2027-02-03" } });

    await user.click(screen.getByRole("button", { name: "Cómo cargar un turno" }));
    // Hay uno arriba y otro al final de la ayuda.
    await user.click(screen.getAllByRole("button", { name: /Volver al turno/ })[0]!);

    expect(screen.getByLabelText("Día")).toBeVisible();
    expect(screen.getByLabelText("Día")).toHaveValue("2027-02-03");
  });

  it("la primera vez en esta computadora el ícono late; las siguientes, no", () => {
    const { unmount } = render(<NuevoTurnoModal date="2027-01-20" prefill={HUECO} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cómo cargar un turno" })).toHaveClass("ayuda-latido");
    unmount();

    render(<NuevoTurnoModal date="2027-01-20" prefill={HUECO} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cómo cargar un turno" })).not.toHaveClass("ayuda-latido");
  });
});
