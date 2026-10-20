import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassOccurrence } from "../../api/types";
import { AnotarEnClaseModal } from "./AnotarEnClaseModal";

vi.mock("../day-view/NewAppointmentModal", () => ({
  CustomerPicker: ({ value, onChange }: { value: unknown; onChange: (c: unknown) => void }) =>
    value ? null : (
      <button type="button" onClick={() => onChange({ id: "c1", name: "Ana" })}>Elegir Ana</button>
    ),
}));

const base = {
  anotadaAlMes: false, suscripcion: null, puedePrueba: false, cuotaSugerida: 30000,
  horariosDelMes: [], subscriptionId: null, clasesDelPlan: null,
  horarios: [
    { scheduleId: "h1", etiqueta: "Lun y Mié 10:00", maquina: "Reformer", clases: 9 },
    { scheduleId: "h2", etiqueta: "Vie 18:00", maquina: null, clases: 4 },
    { scheduleId: "h3", etiqueta: "Sáb 9:00", maquina: null, clases: 0 },
  ],
};
let opciones: Record<string, unknown>;
let anotarMes: { ok: boolean; status: number; body: unknown };
let fetchMock: ReturnType<typeof vi.fn>;

const occ = {
  kind: "activity", subjectId: "a1", startsAt: "2026-11-10T13:00:00.000Z", date: "2026-11-10",
  scheduleId: "h1", name: "Pilates", anotadas: [{ appointmentId: "t0", customerId: "otra", nombre: "Otra", prueba: false, debe: 0, subscriptionId: null, compraId: null }],
} as unknown as ClassOccurrence;

beforeEach(() => {
  opciones = { ...base };
  anotarMes = { ok: true, status: 201, body: { success: true, data: { subscriptionId: "s9", billingCycleId: "b", anotadas: 11, sinLugar: ["2026-11-17T13:00:00.000Z"], superaPlan: false, clasesDelMes: 11 } } };
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const r = url.includes("/opciones")
      ? { ok: true, status: 200, body: { success: true, data: opciones } }
      : url.includes("anotar-al-mes") ? anotarMes
      : url.includes("anotar-a-clase") ? { ok: true, status: 201, body: { success: true, data: { appointmentId: "t1" } } }
      : { ok: true, status: 200, body: { billingCycleId: "b", mes: "2026-11", cuota: 30000, pagado: 0, debe: 30000, isPaid: false } };
    void init;
    return { ok: r.ok, status: r.status, statusText: "x", json: async () => r.body };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function montar(o = occ) {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AnotarEnClaseModal occurrence={o} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}
const posts = (frag: string) => fetchMock.mock.calls.filter(([u, i]) => String(u).includes(frag) && (i as RequestInit | undefined)?.method === "POST");
async function elegir(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Elegir Ana" }));
}
const boton = (n: string | RegExp) => screen.queryByRole("button", { name: n });

describe("AnotarEnClaseModal — qué se ofrece", () => {
  it("ya anotada en esta clase", async () => {
    const user = userEvent.setup();
    montar({ ...occ, anotadas: [{ ...occ.anotadas[0], customerId: "c1" }] } as ClassOccurrence);
    await elegir(user);
    expect(await screen.findByText("Ya está anotada en esta clase.")).toBeInTheDocument();
    expect(boton(/anotar|sumarla|prueba/i)).toBeNull();
  });

  it("anotada al mes: sumarla a esta clase", async () => {
    const user = userEvent.setup();
    opciones = { ...base, anotadaAlMes: true, suscripcion: "activa", horariosDelMes: ["Lun 10:00"] };
    montar();
    await elegir(user);
    expect(await screen.findByText(/Anotada a noviembre: Lun 10:00/)).toBeInTheDocument();
    expect(boton("Sumarla a esta clase")).toBeInTheDocument();
    expect(boton("Anotar al mes")).toBeNull();
    await user.click(boton("Sumarla a esta clase")!);
    await waitFor(() => expect(posts("anotar-a-clase")).toHaveLength(1));
    expect(JSON.parse(posts("anotar-a-clase")[0][1].body)).toEqual({
      activityId: "a1", startsAt: occ.startsAt, customerId: "c1", scheduleId: "h1",
    });
    expect(await screen.findByText("Quedó anotada")).toBeInTheDocument();
  });

  it("suscripción pausada", async () => {
    const user = userEvent.setup();
    opciones = { ...base, suscripcion: "pausada" };
    montar();
    await elegir(user);
    expect(await screen.findByText("La suscripción está pausada: reactivala en Administración → Actividades → Suscripciones.")).toBeInTheDocument();
    expect(boton(/anotar|sumarla|prueba/i)).toBeNull();
  });

  it("suscripción activa no anotada: sólo Anotar al mes", async () => {
    const user = userEvent.setup();
    opciones = { ...base, suscripcion: "activa", puedePrueba: true };
    montar();
    await elegir(user);
    expect(await screen.findByRole("button", { name: "Anotar al mes" })).toBeInTheDocument();
    expect(boton("Clase de prueba")).toBeNull();
  });

  it("nada y puede prueba: ambos", async () => {
    const user = userEvent.setup();
    opciones = { ...base, puedePrueba: true };
    montar();
    await elegir(user);
    expect(await screen.findByRole("button", { name: "Anotar al mes" })).toBeInTheDocument();
    await user.click(boton("Clase de prueba")!);
    await waitFor(() => expect(posts("anotar-a-clase")).toHaveLength(1));
    expect(JSON.parse(posts("anotar-a-clase")[0][1].body)).toEqual({
      activityId: "a1", startsAt: occ.startsAt, customerId: "c1", scheduleId: "h1", prueba: true,
    });
  });

  it("nada y no puede prueba: sólo Anotar al mes", async () => {
    const user = userEvent.setup();
    montar();
    await elegir(user);
    expect(await screen.findByRole("button", { name: "Anotar al mes" })).toBeInTheDocument();
    expect(boton("Clase de prueba")).toBeNull();
    expect(boton("Sumarla a esta clase")).toBeNull();
  });
});

describe("AnotarEnClaseModal — anotar al mes", () => {
  async function abrir(user: ReturnType<typeof userEvent.setup>) {
    montar();
    await elegir(user);
    await user.click(await screen.findByRole("button", { name: "Anotar al mes" }));
    return screen.findByLabelText(/Lun y Mié 10:00/);
  }

  it("viene tildado el horario de la clase, muestra total y cuota", async () => {
    const user = userEvent.setup();
    const h1 = await abrir(user);
    expect(h1).toBeChecked();
    expect(screen.getByLabelText(/Vie 18:00/)).not.toBeChecked();
    expect(screen.getByLabelText(/Lun y Mié 10:00/).closest("label")).toHaveTextContent("· Reformer");
    expect(screen.getByLabelText(/Lun y Mié 10:00/).closest("label")).toHaveTextContent("(9 clases)");
    expect(screen.getByText("9 clases en noviembre")).toBeInTheDocument();
    expect(screen.getByLabelText("Cuota")).toHaveValue(30000);
  });

  it("destildar todos deshabilita los botones", async () => {
    const user = userEvent.setup();
    const h1 = await abrir(user);
    await user.click(h1);
    expect(boton("Anotar y cobrar")).toBeDisabled();
    expect(boton("Anotar, cobro después")).toBeDisabled();
  });

  it("manda el body, muestra lo anotado y lo que no tuvo lugar", async () => {
    const user = userEvent.setup();
    await abrir(user);
    await user.click(screen.getByLabelText(/Vie 18:00/));
    await user.click(boton("Anotar, cobro después")!);
    expect(await screen.findByText("Quedó anotada en 11 clases")).toBeInTheDocument();
    expect(screen.getByText(/Sin lugar: mar 17\/11 10:00/)).toBeInTheDocument();
    expect(JSON.parse(posts("anotar-al-mes")[0][1].body)).toEqual({
      activityId: "a1", customerId: "c1", mes: "2026-11", scheduleIds: ["h1", "h2"], cuota: 30000,
    });
    expect(screen.queryByText("Cobrar la cuota")).toBeNull();
  });

  it("cobro después cierra", async () => {
    const user = userEvent.setup();
    const { onClose } = (() => { const r = montar(); return r; })();
    await elegir(user);
    await user.click(await screen.findByRole("button", { name: "Anotar al mes" }));
    await user.click(await screen.findByRole("button", { name: "Anotar, cobro después" }));
    await user.click(await screen.findByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("avisa si supera el plan pero no bloquea", async () => {
    const user = userEvent.setup();
    opciones = { ...base, clasesDelPlan: 12 };
    await abrir(user);
    expect(screen.queryByText(/Supera las/)).toBeNull();
    await user.click(screen.getByLabelText(/Vie 18:00/));
    expect(screen.getByText("Supera las 12 clases del plan")).toBeInTheDocument();
    expect(boton("Anotar y cobrar")).toBeEnabled();
  });

  it("anotar y cobrar pasa al cobro con la suscripción devuelta", async () => {
    const user = userEvent.setup();
    await abrir(user);
    await user.click(boton("Anotar y cobrar")!);
    expect(await screen.findByText("Cobrar la cuota")).toBeInTheDocument();
    expect(screen.getByText("Quedó anotada en 11 clases")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/training-subscriptions/s9/cuota?mes=2026-11"))).toBe(true);
  });

  it("un 409 muestra el mensaje y no pasa al cobro", async () => {
    const user = userEvent.setup();
    anotarMes = { ok: false, status: 409, body: { error: "Ya está anotada a noviembre" } };
    await abrir(user);
    await user.click(boton("Anotar y cobrar")!);
    expect(await screen.findByText("Ya está anotada a noviembre")).toBeInTheDocument();
    expect(screen.queryByText("Cobrar la cuota")).toBeNull();
    expect(boton("Anotar y cobrar")).toBeEnabled();
  });

  it("el mes se cambia si la clase es desde el 25", async () => {
    const user = userEvent.setup();
    montar({ ...occ, date: "2026-11-26" } as ClassOccurrence);
    await elegir(user);
    await user.click(await screen.findByRole("button", { name: "Anotar al mes" }));
    await user.selectOptions(await screen.findByLabelText("Mes"), "2026-12");
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes("mes=2026-12"))).toBe(true));
    expect(await screen.findByText(/clases en diciembre/)).toBeInTheDocument();
  });
});
