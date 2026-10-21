import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassOccurrence } from "../../api/types";
import { AnotarEnCapacitacionModal } from "./AnotarEnCapacitacionModal";

vi.mock("../day-view/NewAppointmentModal", () => ({
  CustomerPicker: ({ value, onChange }: { value: unknown; onChange: (c: unknown) => void }) =>
    value ? null : <button type="button" onClick={() => onChange({ id: "c1", name: "Ana" })}>Elegir Ana</button>,
}));

let catalogo: { capacitaciones: { id: string; nombre: string; origen: string }[] };
vi.mock("../../api/ventas", () => ({
  useCatalogoVendible: () => ({ data: catalogo, isLoading: false }),
}));
vi.mock("../vender/FormularioVender", () => ({
  FormularioVender: ({ etiqueta, onVendido }: { etiqueta: string; onVendido: (v: unknown) => void }) => (
    <button type="button" onClick={() => onVendido({ compraId: "k9", descripcion: "Capa X" })}>{etiqueta}</button>
  ),
}));
vi.mock("../vender/CobrarLoQueFalta", () => ({
  CobrarLoQueFalta: ({ compraId, abiertoDeEntrada }: { compraId: string; abiertoDeEntrada?: boolean }) => (
    <div>cobro:{compraId}:{abiertoDeEntrada ? "abierto" : "cerrado"}</div>
  ),
}));

const occ = { kind: "training", subjectId: "t1", date: "2026-11-10", name: "Capa X", anotadas: [] } as unknown as ClassOccurrence;

let opciones: Record<string, unknown>;
let anotarResp: { ok: boolean; status: number; body: unknown };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  catalogo = { capacitaciones: [{ id: "t1", nombre: "Capa X", origen: "capacitacion" }] };
  opciones = { compraId: null, debe: 0, encuentrosAnotada: 0, encuentrosQueQuedan: 3 };
  anotarResp = { ok: true, status: 201, body: { success: true, data: { anotada: 3, yaEstaba: 0, sinLugar: [] } } };
  fetchMock = vi.fn(async (url: string) => {
    const r = String(url).includes("opciones-capacitacion")
      ? { ok: true, status: 200, body: { success: true, data: opciones } }
      : anotarResp;
    return { ok: r.ok, status: r.status, statusText: "x", json: async () => r.body };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AnotarEnCapacitacionModal occurrence={occ} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}
const posts = () => fetchMock.mock.calls.filter(([u]) => String(u).includes("anotar-a-capacitacion"));
const elegir = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Elegir Ana" }));

describe("AnotarEnCapacitacionModal", () => {
  it("ya anotada en todo: lo dice y muestra la deuda con cobro", async () => {
    opciones = { compraId: "k1", debe: 5000, encuentrosAnotada: 3, encuentrosQueQuedan: 3 };
    const user = userEvent.setup();
    montar();
    await elegir(user);
    expect(await screen.findByText("Ya está anotada en todos los encuentros que quedan.")).toBeInTheDocument();
    expect(screen.getByText(/Debe \$/)).toBeInTheDocument();
    expect(screen.getByText("cobro:k1:cerrado")).toBeInTheDocument();
  });

  it("compró y faltan encuentros: anota y muestra el resultado con sin lugar", async () => {
    opciones = { compraId: "k1", debe: 0, encuentrosAnotada: 1, encuentrosQueQuedan: 3 };
    anotarResp = { ok: true, status: 201, body: { success: true, data: { anotada: 1, yaEstaba: 1, sinLugar: [3] } } };
    const user = userEvent.setup();
    montar();
    await elegir(user);
    expect(await screen.findByText(/anotada en 1 de 3 encuentros/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anotar en los encuentros" }));
    expect(await screen.findByText("Quedó anotada en 1 encuentro")).toBeInTheDocument();
    expect(screen.getByText("Sin lugar en el encuentro N.º 3")).toBeInTheDocument();
    expect(JSON.parse((posts()[0][1] as RequestInit).body as string)).toEqual({ trainingId: "t1", customerId: "c1" });
  });

  it("sin ninguna anotada por falta de lugar lo dice claro", async () => {
    opciones = { compraId: "k1", debe: 0, encuentrosAnotada: 0, encuentrosQueQuedan: 2 };
    anotarResp = { ok: true, status: 201, body: { success: true, data: { anotada: 0, yaEstaba: 0, sinLugar: [2, 3] } } };
    const user = userEvent.setup();
    montar();
    await elegir(user);
    await user.click(await screen.findByRole("button", { name: "Anotar en los encuentros" }));
    expect(await screen.findByText(/No quedó anotada en ningún encuentro/)).toBeInTheDocument();
    expect(screen.getByText("Sin lugar en los encuentros N.º 2, 3")).toBeInTheDocument();
  });

  it("sin compra: vende, anota primero y recién después ofrece cobrar", async () => {
    const user = userEvent.setup();
    montar();
    await elegir(user);
    await user.click(await screen.findByRole("button", { name: "Vender y anotar" }));
    expect(await screen.findByText("cobro:k9:abierto")).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    expect(screen.getByText("Quedó anotada en 3 encuentros")).toBeInTheDocument();
    // El cobro ya trae su propio "Cobrar después": el modal no le suma otro.
    expect(screen.queryByRole("button", { name: "Cobrar después" })).toBeNull();
  });

  it("queda anclado arriba: buscar clienta no lo hace saltar", () => {
    montar();
    expect(screen.getByRole("dialog").parentElement).toHaveClass("items-start");
  });

  it("capacitación fuera del catálogo vendible: avisa", async () => {
    catalogo = { capacitaciones: [] };
    const user = userEvent.setup();
    montar();
    await elegir(user);
    expect(await screen.findByText("Esta capacitación no está a la venta en el catálogo.")).toBeInTheDocument();
  });

  it("error al anotar tras vender: avisa que la venta quedó y permite reintentar", async () => {
    anotarResp = { ok: false, status: 409, body: { success: false, error: "Sin cupo", message: "Sin cupo" } };
    const user = userEvent.setup();
    montar();
    await elegir(user);
    await user.click(await screen.findByRole("button", { name: "Vender y anotar" }));
    expect(await screen.findByText(/La venta quedó hecha, pero no se pudo anotar: /)).toBeInTheDocument();
    anotarResp = { ok: true, status: 201, body: { success: true, data: { anotada: 3, yaEstaba: 0, sinLugar: [] } } };
    await user.click(screen.getByRole("button", { name: "Reintentar anotar" }));
    await waitFor(() => expect(screen.getByText("cobro:k9:abierto")).toBeInTheDocument());
    expect(posts()).toHaveLength(2);
  });
});
