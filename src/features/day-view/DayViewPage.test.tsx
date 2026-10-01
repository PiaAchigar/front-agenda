import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosParaAgendar } from "../../api/types";

/**
 * Prueba de integración de "A agendar" (Task 16, ronda 2): el prefill que el
 * CRM le pide al dashboard llega acá por la URL de este mismo iframe
 * (`lib/embed.ts`, `prefillDesdeUrl`). No mockeamos `NewAppointmentModal` ni
 * `../../api/agenda`'s hooks de depilación: si el cableado de `DayViewPage`
 * estuviera mal, esto se ve porque el menú de zonas nunca aparece.
 */

const crear = vi.fn();
const CLIENTA = { id: "cu1", name: "Sofía Herrera", dni: "30111222", creditBalance: 0 };
const PROVEEDORA = { id: "prov1", fullName: "Gabi", specialties: null };

// Referencias ESTABLES entre renders — react-query de verdad no devuelve un
// array/objeto nuevo en cada call mientras la data no cambió. Un mock que sí
// lo hace rompe cualquier efecto río abajo que dependa de esa referencia
// (`AttendanceModal` depende de `roster.data` para sincronizar sus tildes):
// la dependencia "cambia" en cada render y el efecto entra en loop infinito.
const SIN_DATOS: never[] = [];
const SIN_MUTAR = { mutate: vi.fn(), isPending: false };
const SIN_MUTAR_CON_ERROR = { ...SIN_MUTAR, error: null };

const datosDepilacion: DatosParaAgendar = {
  nombreDelPack: "Cuerpo Full",
  sesion: 1,
  sesionesTotales: 3,
  presupuestoMinutos: 60,
  zonasDeRegalo: 0,
  sexo: "mujer",
  zonas: [
    { id: "z1", nombre: "Pierna entera", categoria: "grande", minutos: 9, esDeRegalo: false, disponible: true, motivo: null },
  ],
  puerta: {
    puedeAgendar: false,
    puedeReservar: true,
    motivo: "Para agendar hace falta al menos el 40%",
    faltaCobrar: 24000,
  },
  serviceId: "svc-ancla",
};

const CONFIG_VACIA = { openHours: SIN_DATOS };

const TURNO_COMPLETADO = {
  id: "ap1",
  status: "completed",
  customerId: "cu1",
  customerName: "Pía Achigar",
  serviceName: "Depilación Definitiva",
  providerName: "Tamara Belén Galuppo",
  appointmentStart: "2026-09-29T11:00:00.000Z",
  appointmentEnd: "2026-09-29T11:42:00.000Z",
  activityId: null,
  activityName: null,
  customerPurchaseServiceId: "cps1",
  notes: null,
};

vi.mock("../../api/agenda", () => ({
  useAppointments: () => ({ data: SIN_DATOS, isLoading: false, error: null }),
  useComboPendientes: () => ({ data: undefined, isSuccess: false }),
  useCompanyConfig: () => ({ data: CONFIG_VACIA }),
  useProviderSchedule: () => ({ data: SIN_DATOS }),
  useProviders: () => ({ data: SIN_DATOS }),
  useUpdateAppointment: () => SIN_MUTAR,
  useConsumible: () => ({ data: { tipo: "ninguna" }, isFetching: false }),
  useCreateAppointment: () => ({ mutate: crear, isPending: false, error: null }),
  useCreateCustomer: () => SIN_MUTAR,
  useCustomer: () => ({ data: CLIENTA }),
  useCustomerSearch: () => ({ data: SIN_DATOS, isFetching: false }),
  useParaAgendar: () => ({ data: datosDepilacion, isFetching: false }),
  useProvidersByService: (serviceId: string | null) => ({
    data: serviceId ? [PROVEEDORA] : SIN_DATOS,
    isFetching: false,
  }),
  useServices: () => ({ data: SIN_DATOS }),
  useServicesByProvider: () => ({ data: SIN_DATOS, isFetching: false }),
  // `AttendanceModal`, `ReagendarTurnoModal` y `AvisoInsumosModal` se montan
  // SIEMPRE (se apagan por prop, no por `&&`), así que sus hooks corren en
  // cada render aunque el modal esté cerrado.
  useClassRoster: () => ({ data: SIN_DATOS, isLoading: false }),
  useMarkAttendance: () => SIN_MUTAR,
  useRescheduleAppointment: () => SIN_MUTAR_CON_ERROR,
  useReschedules: () => ({ data: SIN_DATOS }),
  useAvailability: () => ({ data: undefined, isFetching: false, isLoading: false }),
  useMonthAvailability: () => ({ data: undefined, isFetching: false }),
}));

// La grilla horaria no aporta nada a esta prueba —sólo hace falta poder
// simular el click en un hueco— y arrastra mucha lógica de columnas/horarios
// que no viene al caso acá.
vi.mock("./CalendarGrid", () => ({
  CalendarGrid: ({
    onSlotClick,
    onAppointmentClick,
  }: {
    onSlotClick: (columnId: string, minutes: number) => void;
    onAppointmentClick: (appt: unknown) => void;
  }) => (
    <>
      <button onClick={() => onSlotClick("prov1", 600)}>abrir un slot cualquiera</button>
      {/* Un turno YA COMPLETADO: es el caso que abre el modal cerrado. */}
      <button onClick={() => onAppointmentClick(TURNO_COMPLETADO)}>
        abrir un turno completado
      </button>
      <button onClick={() => onAppointmentClick({ ...TURNO_COMPLETADO, status: "scheduled" })}>
        abrir un turno agendado
      </button>
      {/* Fechas deliberadamente lejanas: así el cartel de la seña no depende
          del reloj de la máquina que corre la suite. */}
      <button
        onClick={() =>
          onAppointmentClick({
            ...TURNO_COMPLETADO,
            status: "no_show",
            appointmentStart: "2020-01-01T10:00:00.000Z",
            appointmentEnd: "2020-01-01T11:00:00.000Z",
          })
        }
      >
        abrir un ausente que ya pasó
      </button>
      <button
        onClick={() =>
          onAppointmentClick({
            ...TURNO_COMPLETADO,
            status: "no_show",
            appointmentStart: "2099-01-01T10:00:00.000Z",
            appointmentEnd: "2099-01-01T11:00:00.000Z",
          })
        }
      >
        abrir un ausente que todavía no empezó
      </button>
    </>
  ),
}));

const { DayViewPage } = await import("./DayViewPage");

function conUrl(search: string) {
  window.history.pushState({}, "", `/dia${search}`);
}

function montar() {
  return render(
    <BrowserRouter>
      <DayViewPage />
    </BrowserRouter>,
  );
}

beforeEach(() => {
  crear.mockClear();
});

afterEach(() => {
  window.history.pushState({}, "", "/dia");
});

describe("DayViewPage — el prefill de \"A agendar\" llega por la URL", () => {
  it("con purchaseServiceId en la URL, abre el turno nuevo en modo depilación", async () => {
    conUrl("?embed=1&customerId=cu1&purchaseServiceId=cps-depi-1");
    montar();

    expect(await screen.findByText(/cuerpo full.*sesión 1 de 3/i)).toBeInTheDocument();
    expect(screen.queryByText("Servicio")).not.toBeInTheDocument();
  });

  it("con serviceId en la URL (servicio normal), abre el turno nuevo CON LA CLIENTA puesta", async () => {
    // Gemelo del test de depilación de arriba, para el camino más común del
    // salón. Encontró un bug real (Task 16, ronda de arreglos 2):
    // `NewAppointmentModal` sólo precargaba la clienta del prefill cuando
    // `esDepilacion` era true, así que un prefill de servicio normal traía
    // el servicio elegido pero perdía la clienta en silencio — Laura tenía
    // que volver a buscarla a mano, justo lo que "A agendar" existe para
    // ahorrarle.
    conUrl("?embed=1&customerId=cu1&serviceId=svc-full");
    montar();

    expect(await screen.findByText("Servicio")).toBeInTheDocument();
    expect(await screen.findByText("Sofía Herrera")).toBeInTheDocument();
    // Con la clienta ya puesta, el buscador de clientes no debería ofrecerse.
    expect(screen.queryByPlaceholderText(/nombre, dni o teléfono/i)).not.toBeInTheDocument();
  });

  it("lo saca de la URL apenas lo usa: un refresh no puede reabrirlo solo", async () => {
    conUrl("?embed=1&customerId=cu1&purchaseServiceId=cps-depi-1");
    montar();

    await screen.findByText(/cuerpo full.*sesión 1 de 3/i);
    await waitFor(() => {
      expect(window.location.search).not.toContain("purchaseServiceId");
      expect(window.location.search).not.toContain("customerId");
    });
    // El resto de la URL (embed=1) no se pierde en la limpieza.
    expect(window.location.search).toContain("embed=1");
  });

  it("sin prefill en la URL, no abre ningún modal solo", async () => {
    conUrl("?embed=1");
    montar();

    await screen.findByRole("button", { name: /\+ nuevo turno/i });
    expect(screen.queryByText(/sesión \d+ de \d+/i)).not.toBeInTheDocument();
  });

  it("cerrado el turno de depilación, tocar un slot abre el turno normal — no queda pegado", async () => {
    conUrl("?embed=1&customerId=cu1&purchaseServiceId=cps-depi-1");
    const user = userEvent.setup();
    montar();

    await screen.findByText(/cuerpo full.*sesión 1 de 3/i);
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(screen.queryByText(/sesión \d+ de \d+/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /abrir un slot cualquiera/i }));
    expect(await screen.findByText("Servicio")).toBeInTheDocument();
    expect(screen.queryByText(/sesión \d+ de \d+/i)).not.toBeInTheDocument();
  });
});

describe("DayViewPage — un turno completado está cerrado", () => {
  // El backend rechaza cualquier transición que salga de `completed`
  // ("Un turno completado no puede cambiar de estado"), así que ofrecer los
  // botones era ofrecer tres formas de ver un error en rojo.
  it("no ofrece Ausente, Cancelar turno ni Restaurar, y explica por qué", async () => {
    montar();
    await userEvent.click(screen.getByText("abrir un turno completado"));

    expect(await screen.findByText(/ya está cerrado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ausente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar turno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restaurar" })).not.toBeInTheDocument();
  });

  // La contracara: sin esto, esconder los botones SIEMPRE pasaría el test de
  // arriba y dejaría la agenda sin poder cancelar nada.
  it("un turno agendado sí los sigue ofreciendo, y sin el cartel", async () => {
    montar();
    await userEvent.click(screen.getByText("abrir un turno agendado"));

    expect(await screen.findByRole("button", { name: "Cancelar turno" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ausente" })).toBeInTheDocument();
    expect(screen.queryByText(/ya está cerrado/i)).not.toBeInTheDocument();
  });
});

describe("DayViewPage — un turno ausente explica qué hace cada acción", () => {
  // Un ausente NO es terminal: el backend permite las cuatro transiciones, y
  // Cancelar es la ÚNICA que nunca se bloquea por falta de pago — la única
  // salida cuando Restaurar rebota contra la puerta de depilación.
  it("conserva las cuatro acciones", async () => {
    montar();
    await userEvent.click(screen.getByText("abrir un ausente que ya pasó"));

    for (const boton of ["Restaurar", "Cancelar turno", "Realizado", "Reagendar"]) {
      expect(await screen.findByRole("button", { name: boton })).toBeInTheDocument();
    }
  });

  it("pasada la hora, avisa que la seña YA NO se devuelve", async () => {
    montar();
    await userEvent.click(screen.getByText("abrir un ausente que ya pasó"));

    expect(await screen.findByText(/la seña ya no se devuelve/i)).toBeInTheDocument();
    expect(screen.queryByText(/se la devuelve a la clienta/i)).not.toBeInTheDocument();
  });

  it("antes de la hora, avisa que todavía se devuelve como saldo a favor", async () => {
    montar();
    await userEvent.click(screen.getByText("abrir un ausente que todavía no empezó"));

    expect(await screen.findByText(/se la devuelve a la clienta/i)).toBeInTheDocument();
    expect(screen.queryByText(/ya no se devuelve/i)).not.toBeInTheDocument();
  });

  it("un turno agendado no muestra el cartel de ausente", async () => {
    montar();
    await userEvent.click(screen.getByText("abrir un turno agendado"));

    await screen.findByRole("button", { name: "Cancelar turno" });
    expect(screen.queryByText(/Marcado como ausente/i)).not.toBeInTheDocument();
  });
});
