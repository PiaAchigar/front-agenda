import { useEffect, useState } from "react";
import { useAvailability, useCreateAppointment } from "../../api/agenda";
import type { AvailabilitySlot, PendienteDeCombo } from "../../api/types";
import { Button, ErrorNote } from "../../components/ui";

// Mismas clases que `fieldClass` en NewAppointmentModal.tsx. No se comparte
// la constante para no crear un import circular (ese archivo importa a
// éste, en Task 4) — es un solo string, duplicarlo no cuesta nada.
const selectClass =
  "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-surface-low disabled:text-ink-soft";

/** dd/mm, sin año — es siempre el día del turno que se acaba de confirmar. */
function fechaCorta(dateStr: string): string {
  const [, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}`;
}

export type Seleccion = { providerId: string; machineId: string | null; time: string };

type EstadoDeFila = "enviando" | "hecho" | { error: string } | null;

function FilaPendiente({
  pendiente,
  date,
  seleccion,
  estado,
  disabled,
  onChange,
}: {
  pendiente: PendienteDeCombo;
  date: string;
  seleccion: Seleccion | null;
  estado: EstadoDeFila;
  disabled: boolean;
  onChange: (sel: Seleccion | null) => void;
}) {
  const availability = useAvailability(pendiente.serviceId, date);
  const slots: AvailabilitySlot[] = availability.data?.slots ?? [];
  const [tocado, setTocado] = useState(false);

  // Sugiere el hueco más temprano apenas llega, sin pisar lo que Laura ya
  // haya tocado a mano (decisión de Pia, 2026-09-30: cualquiera calificada,
  // el hueco más temprano — nunca la misma proveedora del primer turno). Un
  // efecto y no "sincronizar durante el render": ese idioma sirve para que
  // UN componente mantenga su PROPIO estado al día con sus props; acá lo que
  // cambia es el estado del PADRE (`onChange`), y actualizar otro componente
  // mientras éste se está renderizando es justo lo que React pide evitar.
  const firma =
    slots.length > 0 ? `${slots[0]!.start}|${slots[0]!.options[0]!.providerId}` : "sin-horario";
  useEffect(() => {
    if (tocado) return;
    const primerSlot = slots[0];
    if (!primerSlot) {
      onChange(null);
      return;
    }
    const primeraOpcion = primerSlot.options[0]!;
    onChange({
      providerId: primeraOpcion.providerId,
      machineId: primeraOpcion.machineId,
      time: primerSlot.start,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, tocado]);

  if (availability.isLoading) {
    return <p className="text-xs text-ink-soft">Buscando horario para {pendiente.serviceName}…</p>;
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        No queda horario el {fechaCorta(date)} para <strong>{pendiente.serviceName}</strong>.
      </div>
    );
  }

  const slotElegido = slots.find((s) => s.start === seleccion?.time) ?? slots[0]!;
  const opciones = slotElegido.options;

  return (
    <div className="space-y-2 rounded-xl border border-surface-highest bg-white px-3 py-2">
      <p className="text-sm font-medium text-ink">{pendiente.serviceName}</p>
      <div className="flex gap-2">
        <select
          className={selectClass}
          value={slotElegido.start}
          disabled={disabled}
          onChange={(e) => {
            setTocado(true);
            const nuevoSlot = slots.find((s) => s.start === e.target.value)!;
            const opcion = nuevoSlot.options[0]!;
            onChange({ providerId: opcion.providerId, machineId: opcion.machineId, time: nuevoSlot.start });
          }}
        >
          {slots.map((s) => (
            <option key={s.start} value={s.start}>
              {s.start}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={seleccion?.providerId ?? opciones[0]!.providerId}
          disabled={disabled}
          onChange={(e) => {
            setTocado(true);
            const opcion = opciones.find((o) => o.providerId === e.target.value)!;
            onChange({ providerId: opcion.providerId, machineId: opcion.machineId, time: slotElegido.start });
          }}
        >
          {opciones.map((o) => (
            <option key={o.providerId} value={o.providerId}>
              {o.providerName}
            </option>
          ))}
        </select>
      </div>
      {estado === "hecho" && <p className="text-xs font-medium text-emerald-700">✓ Agendado</p>}
      {estado && typeof estado === "object" && <ErrorNote message={estado.error} />}
    </div>
  );
}

type Props = {
  date: string;
  customerId: string;
  pendientes: PendienteDeCombo[];
  onDone: () => void;
  onCancel: () => void;
};

/**
 * Lo que falta agendar de un combo "se hacen juntos" (V3c), una vez
 * confirmado el primer servicio. Reemplaza el formulario adentro del mismo
 * modal — no abre uno nuevo — y ofrece agendar todo lo que falta con un
 * solo botón.
 */
export function ComboPendientesPanel({ date, customerId, pendientes, onDone, onCancel }: Props) {
  const create = useCreateAppointment();
  const [selecciones, setSelecciones] = useState<Record<string, Seleccion | null>>({});
  const [estados, setEstados] = useState<Record<string, EstadoDeFila>>({});
  const [enviando, setEnviando] = useState(false);

  // `estados[...] !== "hecho"`, no sólo `selecciones[...]`: sin esto, un
  // reintento después de una falla parcial volvía a mandar la fila que YA
  // se había agendado bien. El backend la rechaza (la fila comprada ya
  // está tomada) así que no duplicaba el turno, pero el catch le pisaba el
  // "✓ Agendado" con un error falso — Laura veía un turno bien agendado
  // como si hubiera fallado.
  const aConfirmar = pendientes.filter(
    (p) => selecciones[p.purchaseServiceId] && estados[p.purchaseServiceId] !== "hecho",
  );

  async function confirmarTodo() {
    setEnviando(true);
    const resultados: Record<string, EstadoDeFila> = {};
    for (const p of aConfirmar) {
      const sel = selecciones[p.purchaseServiceId]!;
      setEstados((e) => ({ ...e, [p.purchaseServiceId]: "enviando" }));
      try {
        await create.mutateAsync({
          customerId,
          serviceId: p.serviceId,
          providerId: sel.providerId,
          start: `${date}T${sel.time}:00-03:00`,
          status: "scheduled",
          customerPurchaseServiceId: p.purchaseServiceId,
        });
        resultados[p.purchaseServiceId] = "hecho";
      } catch (err) {
        resultados[p.purchaseServiceId] = {
          error: err instanceof Error ? err.message : "No se pudo agendar",
        };
      }
      setEstados((e) => ({ ...e, [p.purchaseServiceId]: resultados[p.purchaseServiceId]! }));
    }
    setEnviando(false);
    if (aConfirmar.length > 0 && aConfirmar.every((p) => resultados[p.purchaseServiceId] === "hecho")) {
      onDone();
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        Este combo tiene{" "}
        {pendientes.length === 1 ? "1 servicio más" : `${pendientes.length} servicios más`} para agendar
        hoy. Revisá la proveedora y el horario sugeridos, o cambialos.
      </p>
      {pendientes.map((p) => (
        <FilaPendiente
          key={p.purchaseServiceId}
          pendiente={p}
          date={date}
          seleccion={selecciones[p.purchaseServiceId] ?? null}
          estado={estados[p.purchaseServiceId] ?? null}
          disabled={enviando || estados[p.purchaseServiceId] === "hecho"}
          onChange={(sel) => setSelecciones((s) => ({ ...s, [p.purchaseServiceId]: sel }))}
        />
      ))}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={enviando}>
          Ahora no
        </Button>
        <Button onClick={confirmarTodo} disabled={enviando || aConfirmar.length === 0}>
          {enviando
            ? "Agendando…"
            : `Agendar ${aConfirmar.length === 1 ? "el que queda" : `los ${aConfirmar.length} que quedan`}`}
        </Button>
      </div>
    </div>
  );
}
