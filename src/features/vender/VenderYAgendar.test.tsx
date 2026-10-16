import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Catalogo, ItemDeCatalogo } from "../../api/ventas";

const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", creditBalance: "20000.00" };
const OTRA = { id: "cu2", name: "Ana Paz", dni: "1", creditBalance: null };
const EST = { id: "a-est", nombre: "Estética" };
const DEPI = { id: "a-depi", nombre: "Depilación Definitiva" };
const it_ = (p: Partial<ItemDeCatalogo> & Pick<ItemDeCatalogo, "origen" | "id" | "nombre">): ItemDeCatalogo => ({
  packSesiones: null, packDescuentoPct: null, precioDesde: 10000, descripcion: null, desglose: [], area: null, ...p,
});
const CATALOGO: Catalogo = {
  servicios: [it_({ origen: "servicio", id: "s1", nombre: "Limpieza facial", area: EST })],
  combos: [it_({ origen: "combo", id: "c1", nombre: "Combo Glow", area: EST })],
  depilacion: [it_({ origen: "depilacion", id: "d1", nombre: "Piernas", area: DEPI, packSesiones: 6 })],
  capacitaciones: [],
  promociones: [
    { id: "p1", name: "Octubre 20%", discountPercentage: 20, discountAmount: null, promotionType: "descuento", precioDelPaquete: null, destinos: [{ tipo: "servicio", id: "s1", cantidad: 1 }] },
  ],
};
const COTIZACION = {
  description: "Limpieza facial x2", sessionsTotal: 2, baseAmount: 20000, discountedAmount: 20000, finalAmount: 20000,
  promotionId: null, expiresAt: null, comboId: null, depilationComboId: null, serviceId: "s1", trainingId: null,
};

const pedidos: unknown[] = [];
let errorDeCotizacion: Error | null = null;
let errorDeCatalogo: Error | null = null;
const vender = vi.fn((_i: unknown, o?: { onSuccess?: (r: unknown) => void }) => o?.onSuccess?.({ id: "pu9" }));
const despues = vi.fn();

vi.mock("../../api/ventas", () => ({
  useCatalogoVendible: () => (errorDeCatalogo ? { data: undefined, isLoading: false, error: errorDeCatalogo } : { data: CATALOGO, isLoading: false, error: null }),
  useCotizacion: (p: unknown) => {
    pedidos.push(p);
    if (!p) return { data: undefined, isFetching: false, error: null };
    return errorDeCotizacion
      ? { data: undefined, isFetching: false, error: errorDeCotizacion }
      : { data: COTIZACION, isFetching: false, error: null };
  },
  useVender: () => ({ mutate: vender, isPending: false, error: null }),
}));
vi.mock("../../api/agenda", () => ({
  useCustomerSearch: (q: string) => ({ data: q ? [CLIENTA, OTRA] : [], isFetching: false }),
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock("./DespuesDeVender", () => ({
  DespuesDeVender: (props: unknown) => {
    despues(props);
    return <div>DESPUES DE VENDER</div>;
  },
}));

const { VenderYAgendar } = await import("./VenderYAgendar");

function montar() {
  const onAgendar = vi.fn();
  const onClose = vi.fn();
  render(
    <VenderYAgendar date="2027-01-20" hueco={{ providerId: "prov1", providerName: "Gabi", minutes: 930 }}
      solapas={<div>SOLAPAS</div>} onClose={onClose} onAgendar={onAgendar} />,
  );
  return { onAgendar, onClose };
}

async function elegirClienta(user: ReturnType<typeof userEvent.setup>, nombre = /Sofía Herrera/) {
  await user.type(screen.getByPlaceholderText(/nombre, dni/i), "an");
  await user.click(await screen.findByText(nombre));
}

beforeEach(() => {
  pedidos.length = 0;
  errorDeCotizacion = null;
  errorDeCatalogo = null;
  vender.mockClear();
  despues.mockClear();
});

describe("VenderYAgendar — hasta vender", () => {
  it("abre con el día y la hora del hueco, editables", () => {
    montar();
    expect(screen.getByText("SOLAPAS")).toBeInTheDocument();
    expect(screen.getByLabelText("Día")).toHaveValue("2027-01-20");
    expect(screen.getByLabelText("Hora")).toHaveValue("15:30");
  });

  it("el select de áreas sale del catálogo, con Promos al final", () => {
    montar();
    const opciones = within(screen.getByLabelText("Área")).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Elegí un área…", "Depilación Definitiva", "Estética", "Promos"]);
  });

  it("elegido el área, el select de qué sólo trae lo de esa área", async () => {
    const user = userEvent.setup();
    montar();
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    const que = screen.getByLabelText("Qué");
    expect(within(que).getByRole("option", { name: /limpieza facial/i })).toBeInTheDocument();
    expect(within(que).getByRole("option", { name: /combo glow/i })).toBeInTheDocument();
    expect(within(que).queryByRole("option", { name: /piernas/i })).not.toBeInTheDocument();
  });

  it("cotiza con clienta, item, sesiones y promo, y vende exactamente lo cotizado", async () => {
    const user = userEvent.setup();
    montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    fireEvent.change(screen.getByLabelText("Sesiones"), { target: { value: "2" } });
    await user.selectOptions(screen.getByLabelText("Promo"), "p1");
    expect(pedidos.at(-1)).toEqual({ origen: "servicio", id: "s1", sessions: 2, promotionId: "p1", customerId: "cu1" });

    await user.click(screen.getByRole("button", { name: /^vender/i }));
    expect(vender).toHaveBeenCalledWith({ ...COTIZACION, customerId: "cu1", usarSaldo: 0 }, expect.anything());
    expect(await screen.findByText("DESPUES DE VENDER")).toBeInTheDocument();
    expect(despues).toHaveBeenLastCalledWith(
      expect.objectContaining({ compraId: "pu9", customerId: "cu1", fecha: "2027-01-20", hueco: { providerId: "prov1", providerName: "Gabi", minutes: 930 } }),
    );
  });

  it("usar el saldo a favor manda cuánto entra", async () => {
    const user = userEvent.setup();
    montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    await user.click(screen.getByLabelText(/usar saldo a favor/i));
    await user.click(screen.getByRole("button", { name: /^vender/i }));
    expect(vender).toHaveBeenCalledWith(expect.objectContaining({ usarSaldo: 20000 }), expect.anything());
  });

  it("cambiar de área limpia lo elegido: no se cotiza nada de otra área", async () => {
    const user = userEvent.setup();
    montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    await user.selectOptions(screen.getByLabelText("Área"), "a-depi");
    expect(pedidos.at(-1)).toBeNull();
    expect(screen.getByRole("button", { name: /^vender/i })).toBeDisabled();
  });

  it("cambiar de clienta limpia lo elegido", async () => {
    const user = userEvent.setup();
    montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    await user.click(screen.getByRole("button", { name: /cambiar/i }));
    await elegirClienta(user, /Ana Paz/);
    expect(pedidos.at(-1)).toBeNull();
  });

  it("si la cotización falla, se ve el motivo de la API y Vender queda apagado", async () => {
    const user = userEvent.setup();
    errorDeCotizacion = new Error("La promo ya no tiene cupo");
    montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    expect(screen.getByText("La promo ya no tiene cupo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^vender/i })).toBeDisabled();
  });

  it("cerrar después de vender muestra el aviso, no cierra en silencio", async () => {
    const user = userEvent.setup();
    const { onClose } = montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    await user.click(screen.getByRole("button", { name: /^vender/i }));
    // Clic en el fondo del modal = onClose del <Modal>.
    await user.click(screen.getByText("DESPUES DE VENDER").closest(".fixed")!);
    expect(screen.getByText(/la venta quedó en la ficha de sofía herrera como “a agendar”/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^cerrar$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("con un horario que ya pasó avisa y no deja vender", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2027-01-20T18:00:00Z")); // 15:00 ART
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    montar(); // hueco a las 15:30 del 2027-01-20
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    expect(screen.getByRole("button", { name: /^vender/i })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "14:00" } });
    expect(screen.getByText("Ese horario ya pasó. Elegí uno a partir de ahora.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^vender/i })).toBeDisabled();
    vi.useRealTimers();
  });
});

describe("VenderYAgendar — fallas y Sesiones", () => {
  it("si el catálogo no carga, lo dice en vez de dejar el área vacía", () => {
    errorDeCatalogo = new Error("Forbidden");
    montar();
    expect(screen.getByText(/no se pudo cargar lo que se puede vender: forbidden/i)).toBeInTheDocument();
  });

  async function hastaSesiones(user: ReturnType<typeof userEvent.setup>) {
    montar();
    await elegirClienta(user);
    await user.selectOptions(screen.getByLabelText("Área"), "a-est");
    await user.selectOptions(screen.getByLabelText("Qué"), "servicio:s1");
    return screen.getByLabelText("Sesiones") as HTMLInputElement;
  }

  it("Sesiones se puede vaciar y escribir de nuevo sin que se pegue el 1 (borrar y 6 = 6, no 16)", async () => {
    const user = userEvent.setup();
    const input = await hastaSesiones(user);
    await user.clear(input);
    expect(input.value).toBe("");
    await user.type(input, "6");
    expect(input.value).toBe("6");
    expect((pedidos.at(-1) as { sessions: number }).sessions).toBe(6);
  });

  it("mientras Sesiones está vacío no se cotiza otra cosa; al salir vuelve a 1", async () => {
    const user = userEvent.setup();
    const input = await hastaSesiones(user);
    await user.clear(input);
    expect((pedidos.at(-1) as { sessions: number }).sessions).toBe(1);
    fireEvent.blur(input);
    expect(input.value).toBe("1");
  });

  it("Sesiones sólo acepta enteros de 1 para arriba (2.5 y 0 no entran a la cotización)", async () => {
    const user = userEvent.setup();
    const input = await hastaSesiones(user);
    fireEvent.change(input, { target: { value: "2.5" } });
    expect((pedidos.at(-1) as { sessions: number }).sessions).toBe(1);
    fireEvent.change(input, { target: { value: "0" } });
    expect((pedidos.at(-1) as { sessions: number }).sessions).toBe(1);
    fireEvent.blur(input);
    expect(input.value).toBe("1");
    fireEvent.change(input, { target: { value: "3" } });
    expect((pedidos.at(-1) as { sessions: number }).sessions).toBe(3);
  });
});
