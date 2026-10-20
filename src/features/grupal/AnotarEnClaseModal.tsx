import { useState } from "react";
import { useAnotarAClase, useOpcionesParaAnotar, type AnotarAlMesResultado } from "../../api/grupal";
import type { ClassOccurrence, Customer } from "../../api/types";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { CustomerPicker } from "../day-view/NewAppointmentModal";
import { AnotarAlMes, clases, fechaCorta } from "./AnotarAlMes";
import { CobrarCuota, mesEnLetras } from "./CobrarCuota";

type Resultado = { r: AnotarAlMesResultado; mes: string; cobrar: boolean };

/** "Anotar" en una clase de actividad: según la clienta, ofrece pase libre, prueba o anotarla al mes. */
export function AnotarEnClaseModal({ occurrence, onClose }: { occurrence: ClassOccurrence; onClose: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [alMes, setAlMes] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [listo, setListo] = useState(false);

  const cambiarClienta = (c: Customer | null) => {
    setCustomer(c);
    setAlMes(false);
  };

  return (
    <Modal open onClose={onClose} title={`Anotar en ${occurrence.name}`}>
      {listo ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">Quedó anotada</p>
          <div className="flex justify-end border-t border-surface-high pt-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      ) : resultado ? (
        <Anotada
          resultado={resultado}
          occurrence={occurrence}
          customer={customer}
          onClose={onClose}
        />
      ) : (
        <div className="space-y-3">
          <CustomerPicker value={customer} onChange={cambiarClienta} />
          {customer && !alMes && (
            <Ofertas occurrence={occurrence} customer={customer} onAlMes={() => setAlMes(true)} onListo={() => setListo(true)} />
          )}
          {customer && alMes && (
            <AnotarAlMes
              activityId={occurrence.subjectId}
              customerId={customer.id}
              fechaDeLaClase={occurrence.date}
              scheduleIdDeLaClase={occurrence.scheduleId}
              onAnotada={(r, mes, cobrar) => setResultado({ r, mes, cobrar })}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function Resumen({ r }: { r: AnotarAlMesResultado }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-ink">
        {r.anotadas === 0 ? "No quedó anotada en ninguna clase" : `Quedó anotada en ${clases(r.anotadas)}`}
      </p>
      {r.sinLugar.length > 0 && (
        <p className="text-amber-700">Sin lugar: {r.sinLugar.map(fechaCorta).join(", ")}</p>
      )}
    </div>
  );
}

function Anotada({
  resultado, occurrence, customer, onClose,
}: { resultado: Resultado; occurrence: ClassOccurrence; customer: Customer | null; onClose: () => void }) {
  const { r, mes, cobrar } = resultado;
  // Sin ninguna clase no hay nada que cobrar: nunca se pasa al cobro.
  if (!cobrar || r.anotadas === 0) {
    return (
      <div className="space-y-3">
        <Resumen r={r} />
        <div className="flex justify-end border-t border-surface-high pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Resumen r={r} />
      <CobrarCuota
        subscriptionId={r.subscriptionId}
        mes={mes}
        descripcion={`${occurrence.name} — ${mesEnLetras(mes)} ${mes.slice(0, 4)} · ${customer?.name ?? "Sin nombre"}`}
        onCobrado={onClose}
        onCerrar={onClose}
      />
    </div>
  );
}

function Ofertas({
  occurrence, customer, onAlMes, onListo,
}: { occurrence: ClassOccurrence; customer: Customer; onAlMes: () => void; onListo: () => void }) {
  const mes = occurrence.date.slice(0, 7);
  const yaEsta = occurrence.anotadas.some((a) => a.customerId === customer.id);
  const opciones = useOpcionesParaAnotar(occurrence.subjectId, yaEsta ? null : customer.id, mes);
  const anotar = useAnotarAClase();

  if (yaEsta) return <p className="text-sm text-ink">Ya está anotada en esta clase.</p>;
  if (opciones.error) return <ErrorNote message={(opciones.error as Error).message} />;
  if (!opciones.data) return <p className="text-sm text-ink-soft">Viendo qué se le puede ofrecer…</p>;
  const o = opciones.data;

  if (o.suscripcion === "pausada" && !o.anotadaAlMes) {
    return (
      <p className="text-sm text-ink">
        La suscripción está pausada: reactivala en Administración → Actividades → Suscripciones.
      </p>
    );
  }

  const enviar = (prueba: boolean) =>
    anotar.mutate(
      {
        activityId: occurrence.subjectId,
        startsAt: occurrence.startsAt,
        customerId: customer.id,
        scheduleId: occurrence.scheduleId ?? undefined,
        ...(prueba ? { prueba: true } : {}),
      },
      { onSuccess: onListo },
    );

  return (
    <div className="space-y-3">
      {o.anotadaAlMes && (
        <p className="text-sm text-ink">
          Anotada a {mesEnLetras(mes)}: {o.horariosDelMes.join(", ")}
        </p>
      )}
      {anotar.error && <ErrorNote message={(anotar.error as Error).message} />}
      <div className="flex flex-wrap justify-end gap-2 border-t border-surface-high pt-3">
        {o.anotadaAlMes ? (
          <Button type="button" disabled={anotar.isPending} onClick={() => enviar(false)}>
            Sumarla a esta clase
          </Button>
        ) : (
          <>
            {!o.suscripcion && o.puedePrueba && (
              <Button type="button" variant="secondary" disabled={anotar.isPending} onClick={() => enviar(true)}>
                Clase de prueba
              </Button>
            )}
            <Button type="button" disabled={anotar.isPending} onClick={onAlMes}>
              Anotar al mes
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
