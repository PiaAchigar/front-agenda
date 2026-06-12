import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateAppointment } from "../../api/agenda";
import { ApiError } from "../../api/client";
import { Button, Card, ErrorNote } from "../../components/ui";
import { StepCustomer } from "./StepCustomer";
import { StepDate } from "./StepDate";
import { StepService } from "./StepService";
import { StepSlot } from "./StepSlot";
import { STEPS, type BookingState } from "./types";

const INITIAL: BookingState = {
  service: null,
  date: null,
  slot: null,
  customer: null,
  priceMode: "list",
};

export function BookingPage() {
  const [state, setState] = useState<BookingState>(INITIAL);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const create = useCreateAppointment();

  const formatDate = (date: string) =>
    new Date(`${date}T12:00:00-03:00`).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  const confirm = () => {
    if (!state.service || !state.date || !state.slot || !state.customer) return;
    create.mutate(
      {
        customerId: state.customer.id,
        serviceId: state.service.id,
        providerId: state.slot.option.providerId,
        machineId: state.slot.option.machineId ?? undefined,
        start: `${state.date}T${state.slot.start}:00-03:00`,
        priceMode: state.priceMode,
      },
      { onSuccess: () => navigate("/") },
    );
  };

  // Un 409 significa que el horario se ocupó mientras confirmábamos:
  // volvemos al paso de horario con la disponibilidad fresca
  const conflictError = create.error instanceof ApiError && create.error.status === 409;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              i === step
                ? "bg-primary text-white"
                : i < step
                  ? "bg-primary-container/50 text-primary-dark hover:bg-primary-container"
                  : "bg-surface-high text-ink-soft"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <StepService
          onSelect={(service) => {
            setState({ ...INITIAL, service });
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <StepDate
          onSelect={(date) => {
            setState((s) => ({ ...s, date, slot: null }));
            setStep(2);
          }}
        />
      )}

      {step === 2 && state.service && state.date && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            {state.service.name} · {formatDate(state.date)}
          </p>
          <StepSlot
            serviceId={state.service.id}
            date={state.date}
            onSelect={(slot) => {
              setState((s) => ({ ...s, slot }));
              setStep(3);
            }}
          />
        </div>
      )}

      {step === 3 && (
        <StepCustomer
          onSelect={(customer) => {
            setState((s) => ({ ...s, customer }));
            setStep(4);
          }}
        />
      )}

      {step === 4 && state.service && state.date && state.slot && state.customer && (
        <Card className="mx-auto max-w-lg space-y-4">
          <h3 className="text-2xl font-semibold">Confirmar turno</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Servicio</dt>
              <dd className="font-medium">{state.service.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Fecha</dt>
              <dd className="font-medium capitalize">{formatDate(state.date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Horario</dt>
              <dd className="font-medium">
                {state.slot.start}–{state.slot.end} hs
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Profesional</dt>
              <dd className="font-medium">{state.slot.option.providerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Cliente</dt>
              <dd className="font-medium">{state.customer.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Precio</dt>
              <dd>
                <select
                  value={state.priceMode}
                  onChange={(e) =>
                    setState((s) => ({ ...s, priceMode: e.target.value as "list" | "cash" }))
                  }
                  className="rounded-lg border border-surface-highest bg-white px-2 py-1 text-sm"
                >
                  <option value="list">
                    Lista ${state.service.unitPriceList?.toLocaleString("es-AR") ?? "—"}
                  </option>
                  <option value="cash">
                    Efectivo ${state.service.unitPriceCash?.toLocaleString("es-AR") ?? "—"}
                  </option>
                </select>
              </dd>
            </div>
          </dl>

          {create.error && (
            <div className="space-y-2">
              <ErrorNote message={(create.error as Error).message} />
              {conflictError && (
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Elegir otro horario
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={confirm} disabled={create.isPending}>
              {create.isPending ? "Reservando…" : "Confirmar reserva"}
            </Button>
            <Button variant="ghost" onClick={() => setStep(3)}>
              Volver
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
