import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Catalogo, ItemDeCatalogo, PromoVendible } from "../../api/ventas";

const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", creditBalance: null, phone: null, email: null };
const it_ = (p: Partial<ItemDeCatalogo> & Pick<ItemDeCatalogo, "origen" | "id" | "nombre">): ItemDeCatalogo => ({
  packSesiones: null, packDescuentoPct: null, precioDesde: 10000, descripcion: null, desglose: [], area: null, ...p,
});
const SERVICIO = it_({ origen: "servicio", id: "s1", nombre: "Limpieza facial" });
const PACK = it_({ origen: "combo", id: "c1", nombre: "Pack Glow x4", packSesiones: 4 });
const PROMO_PAQUETE: PromoVendible = { id: "pp", name: "Paquete Verano", discountPercentage: null, discountAmount: null, promotionType: "paquete", precioDelPaquete: 50000, destinos: [] };
const PROMO_DESCUENTO: PromoVendible = { id: "p1", name: "Octubre 20%", discountPercentage: 20, discountAmount: null, promotionType: "descuento", precioDelPaquete: null, destinos: [{ tipo: "servicio", id: "s1", cantidad: 1 }] };
const CATALOGO: Catalogo = { servicios: [SERVICIO], combos: [PACK], depilacion: [], capacitaciones: [], promociones: [PROMO_PAQUETE, PROMO_DESCUENTO] };
const COTIZACION = {
  description: "Pack Glow x4", sessionsTotal: 4, baseAmount: 40000, discountedAmount: 40000, finalAmount: 40000,
  promotionId: null, expiresAt: null, comboId: "c1", depilationComboId: null, serviceId: null, trainingId: null,
};

const pedidos: unknown[] = [];
let errorDeCotizacion: Error | null = null;
const vender = vi.fn((_i: unknown, o?: { onSuccess?: (r: unknown) => void }) => o?.onSuccess?.({ id: "pu9" }));

vi.mock("../../api/ventas", () => ({
  useCatalogoVendible: () => ({ data: CATALOGO, isLoading: false, error: null }),
  useCotizacion: (p: unknown) => {
    pedidos.push(p);
    if (!p) return { data: undefined, isFetching: false, error: null };
    return errorDeCotizacion
      ? { data: undefined, isFetching: false, error: errorDeCotizacion }
      : { data: COTIZACION, isFetching: false, error: null };
  },
  useVender: () => ({ mutate: vender, isPending: false, error: null }),
}));

const { FormularioVender } = await import("./FormularioVender");

type Eleccion = Parameters<typeof FormularioVender>[0]["eleccion"];
function montar(eleccion: Eleccion) {
  const onVendido = vi.fn();
  render(
    <FormularioVender eleccion={eleccion} customer={CLIENTA} fecha="2099-01-20" minutos={930} onVendido={onVendido} />,
  );
  return { onVendido };
}

beforeEach(() => {
  errorDeCotizacion = null;
  pedidos.length = 0;
  vender.mockClear();
});

describe("FormularioVender", () => {
  it("con un pack elegido cotiza y al vender avisa con onVendido", async () => {
    const { onVendido } = montar({ tipo: "pack", item: PACK });
    expect(pedidos.at(-1)).toEqual({ origen: "combo", id: "c1", sessions: 1, promotionId: null, customerId: "cu1" });
    await userEvent.click(screen.getByRole("button", { name: "Vender y agendar" }));
    expect(vender).toHaveBeenCalledWith({ ...COTIZACION, customerId: "cu1", usarSaldo: 0 }, expect.anything());
    expect(onVendido).toHaveBeenCalledWith({ compraId: "pu9", descripcion: "Pack Glow x4" });
  });

  it("con un servicio y cuando=ahora vende ese servicio como compra, con sesiones editables", async () => {
    const { onVendido } = montar({ tipo: "servicio", item: SERVICIO });
    expect(screen.getByLabelText("Sesiones")).toBeInTheDocument();
    expect(pedidos.at(-1)).toEqual({ origen: "servicio", id: "s1", sessions: 1, promotionId: null, customerId: "cu1" });
    await userEvent.click(screen.getByRole("button", { name: "Vender y agendar" }));
    expect(onVendido).toHaveBeenCalledTimes(1);
  });

  it("una promo paquete se vende como la promo misma", () => {
    montar({ tipo: "promo", promo: PROMO_PAQUETE });
    expect(pedidos.at(-1)).toEqual({ origen: "paquete", promotionId: "pp", customerId: "cu1" });
  });

  it("una promo de descuento pide a qué se le aplica y cotiza ese item con la promo", async () => {
    montar({ tipo: "promo", promo: PROMO_DESCUENTO });
    expect(pedidos.at(-1)).toBeNull();
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("¿A qué se le aplica?"), "servicio:s1");
    expect(pedidos.at(-1)).toEqual({ origen: "servicio", id: "s1", sessions: 1, promotionId: "p1", customerId: "cu1" });
  });

  it("sin clienta no cotiza ni deja vender", () => {
    render(<FormularioVender eleccion={{ tipo: "servicio", item: SERVICIO }} customer={null} fecha="2099-01-20" minutos={930}
      onVendido={vi.fn()} />);
    expect(pedidos.at(-1)).toBeNull();
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeDisabled();
  });

  // Portados de los tests de VenderYAgendar (el envoltorio se fue con las solapas).

  it("usar el saldo a favor manda cuánto entra", async () => {
    render(<FormularioVender eleccion={{ tipo: "servicio", item: SERVICIO }} customer={{ ...CLIENTA, creditBalance: "20000.00" }}
      fecha="2099-01-20" minutos={930}
      onVendido={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/usar saldo a favor/i));
    await userEvent.click(screen.getByRole("button", { name: "Vender y agendar" }));
    expect(vender).toHaveBeenCalledWith(expect.objectContaining({ usarSaldo: 20000 }), expect.anything());
  });

  it("si la cotización falla, se ve el motivo de la API y Vender queda apagado", () => {
    errorDeCotizacion = new Error("La promo ya no tiene cupo");
    montar({ tipo: "servicio", item: SERVICIO });
    expect(screen.getByText("La promo ya no tiene cupo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeDisabled();
  });

  it("con un horario que ya pasó no deja vender", () => {
    render(<FormularioVender eleccion={{ tipo: "servicio", item: SERVICIO }} customer={CLIENTA} fecha="2020-01-20" minutos={600}
      onVendido={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Vender y agendar" })).toBeDisabled();
  });

  describe("Sesiones", () => {
    const hastaSesiones = () => {
      montar({ tipo: "servicio", item: SERVICIO });
      return screen.getByLabelText("Sesiones") as HTMLInputElement;
    };

    it("se puede vaciar y escribir de nuevo sin que se pegue el 1 (borrar y 6 = 6, no 16)", async () => {
      const input = hastaSesiones();
      await userEvent.clear(input);
      expect(input.value).toBe("");
      await userEvent.type(input, "6");
      expect(input.value).toBe("6");
      expect((pedidos.at(-1) as { sessions: number }).sessions).toBe(6);
    });

    it("mientras está vacío no se cotiza otra cosa; al salir vuelve a 1", async () => {
      const input = hastaSesiones();
      await userEvent.clear(input);
      expect((pedidos.at(-1) as { sessions: number }).sessions).toBe(1);
      fireEvent.blur(input);
      expect(input.value).toBe("1");
    });

    it("sólo acepta enteros de 1 para arriba (2.5 y 0 no entran a la cotización)", () => {
      const input = hastaSesiones();
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
});
