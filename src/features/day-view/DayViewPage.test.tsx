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

vi.mock("../../api/agenda", () => ({
  useAppointments: () => ({ data: SIN_DATOS, isLoading: false, error: null }),
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
  // `AttendanceModal`, `ReschedulingModal` y `AvisoInsumosModal` se montan
  // SIEMPRE (se apagan por prop, no por `&&`), así que sus hooks corren en
  // cada render aunque el modal esté cerrado.
  useClassRoster: () => ({ data: SIN_DATOS, isLoading: false }),
  useMarkAttendance: () => SIN_MUTAR,
  useRescheduleAppointment: () => SIN_MUTAR_CON_ERROR,
  useReschedules: () => ({ data: SIN_DATOS }),
}));

// La grilla horaria no aporta nada a esta prueba —sólo hace falta poder
// simular el click en un hueco— y arrastra mucha lógica de columnas/horarios
// que no viene al caso acá.
vi.mock("./CalendarGrid", () => ({
  CalendarGrid: ({ onSlotClick }: { onSlotClick: (columnId: string, minutes: number) => void }) => (
    <button onClick={() => onSlotClick("prov1", 600)}>abrir un slot cualquiera</button>
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
