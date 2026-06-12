import { useState } from "react";
import { useAvailability } from "../../api/agenda";
import type { AvailabilitySlot, SlotOption } from "../../api/types";
import { Button, Card, ErrorNote, Spinner } from "../../components/ui";

export function StepSlot({
  serviceId,
  date,
  onSelect,
}: {
  serviceId: string;
  date: string;
  onSelect: (slot: { start: string; end: string; option: SlotOption }) => void;
}) {
  const { data, isLoading, error } = useAvailability(serviceId, date);
  const [pending, setPending] = useState<AvailabilitySlot | null>(null);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorNote message={(error as Error).message} />;

  if (data?.reason === "closed") {
    return <Card className="text-center text-ink-soft">El local está cerrado ese día.</Card>;
  }
  if (data?.reason === "no_providers" || data?.slots.length === 0) {
    return (
      <Card className="text-center text-ink-soft">
        No hay horarios disponibles para esa fecha. Probá con otro día.
      </Card>
    );
  }

  // Si el slot tiene una sola proveedora se elige directo; si hay varias, se pregunta
  const pick = (slot: AvailabilitySlot) => {
    if (slot.options.length === 1) {
      onSelect({ start: slot.start, end: slot.end, option: slot.options[0] });
    } else {
      setPending(slot);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {data?.slots.map((slot) => (
          <button
            key={slot.start}
            onClick={() => pick(slot)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              pending?.start === slot.start
                ? "border-primary bg-primary text-white"
                : "border-surface-highest bg-surface-low hover:border-primary hover:text-primary"
            }`}
          >
            {slot.start}
          </button>
        ))}
      </div>

      {pending && pending.options.length > 1 && (
        <Card>
          <h4 className="mb-3 font-medium">¿Con quién a las {pending.start}?</h4>
          <div className="flex flex-wrap gap-2">
            {pending.options.map((option) => (
              <Button
                key={`${option.providerId}-${option.machineId ?? ""}`}
                variant="secondary"
                onClick={() =>
                  onSelect({ start: pending.start, end: pending.end, option })
                }
              >
                {option.providerName}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
