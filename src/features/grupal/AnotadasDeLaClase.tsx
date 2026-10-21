import { ESTILO_DEBE } from "../../lib/estado-de-clase";
import { useState } from "react";
import { Badge, Button, ErrorNote, Modal } from "../../components/ui";
import { useSacarDeClase } from "../../api/grupal";
import { pesos } from "../../lib/vender";
import type { Anotada } from "../../api/types";
import { DarDeBajaModal } from "./DarDeBajaModal";

const VISIBLES = 6;

/** Las anotadas de una clase: nombre, si es prueba, lo que debe, y sacarla. */
export function AnotadasDeLaClase({
  anotadas,
  puedeSacar,
  capacitacionId,
  onCobrar,
}: {
  anotadas: Anotada[];
  /** Falso en una clase que ya pasó */
  puedeSacar: boolean;
  /** En un encuentro de capacitación, sacar es la baja de toda la capacitación. */
  capacitacionId?: string;
  onCobrar: (a: Anotada) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  // La anotada que se está por sacar: mientras no sea null, el modal pide confirmar.
  const [aSacar, setASacar] = useState<Anotada | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<Anotada | null>(null);
  const sacar = useSacarDeClase();

  if (anotadas.length === 0) return null;

  const visibles = verTodas ? anotadas : anotadas.slice(0, VISIBLES);
  const resto = anotadas.length - VISIBLES;

  const cerrarModal = () => {
    setASacar(null);
    sacar.reset();
  };

  const confirmarSacar = () => {
    if (!aSacar) return;
    sacar.mutate(aSacar.appointmentId, { onSuccess: () => setASacar(null) });
  };

  return (
    <div className="mt-3">
      <ul className="flex flex-wrap gap-2">
        {visibles.map((a) => {
          const nombre = a.nombre ?? "Sin nombre";
          return (
            <li
              key={a.appointmentId}
              className="flex items-center gap-1.5 rounded-full border border-surface-high bg-surface px-2.5 py-1 text-sm text-ink"
            >
              <span>{nombre}</span>
              {a.prueba && <Badge tone="primary">Prueba</Badge>}
              {a.debe > 0 && (
                <button
                  type="button"
                  onClick={() => onCobrar(a)}
                  className={`${ESTILO_DEBE} hover:bg-amber-200`}
                >
                  Debe {pesos(a.debe)}
                </button>
              )}
              {puedeSacar && (
                <button
                  type="button"
                  aria-label={
                    capacitacionId ? `Dar de baja a ${nombre} de la capacitación` : `Sacar a ${nombre} de esta clase`
                  }
                  disabled={sacar.isPending}
                  onClick={() => (capacitacionId && a.customerId ? setADarDeBaja(a) : setASacar(a))}
                  className="px-1 text-ink-soft hover:text-red-600 disabled:opacity-40"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
        {!verTodas && resto > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setVerTodas(true)}
              className="rounded-full px-2.5 py-1 text-sm font-medium text-primary-dark hover:bg-surface-high"
            >
              +{resto}
            </button>
          </li>
        )}
      </ul>
      {aDarDeBaja && capacitacionId && aDarDeBaja.customerId && (
        <DarDeBajaModal
          trainingId={capacitacionId}
          customerId={aDarDeBaja.customerId}
          nombre={aDarDeBaja.nombre ?? "esta clienta"}
          onClose={() => setADarDeBaja(null)}
        />
      )}
      <Modal open={aSacar !== null} onClose={cerrarModal} title="Sacar de la clase">
        <div className="space-y-4">
          <p className="text-sm text-ink">¿Sacar a {aSacar?.nombre ?? "esta clienta"} de esta clase?</p>
          <p className="text-xs text-ink-soft">Se cancela su turno y se libera el lugar.</p>
          {sacar.error && <ErrorNote message={(sacar.error as Error).message} />}
          <div className="flex justify-end gap-2 border-t border-surface-high pt-3">
            <Button type="button" variant="secondary" onClick={cerrarModal} disabled={sacar.isPending}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={confirmarSacar} disabled={sacar.isPending}>
              {sacar.isPending ? "Sacando…" : "Sacar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
