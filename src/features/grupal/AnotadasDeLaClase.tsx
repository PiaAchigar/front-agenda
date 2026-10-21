import { ESTILO_DEBE } from "../../lib/estado-de-clase";
import { useState } from "react";
import { Badge, ErrorNote } from "../../components/ui";
import { useSacarDeClase } from "../../api/grupal";
import { pesos } from "../../lib/vender";
import type { Anotada } from "../../api/types";

const VISIBLES = 6;

/** Las anotadas de una clase: nombre, si es prueba, lo que debe, y sacarla. */
export function AnotadasDeLaClase({
  anotadas,
  puedeSacar,
  onCobrar,
}: {
  anotadas: Anotada[];
  /** Falso en una clase que ya pasó */
  puedeSacar: boolean;
  onCobrar: (a: Anotada) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const sacar = useSacarDeClase();

  if (anotadas.length === 0) return null;

  const visibles = verTodas ? anotadas : anotadas.slice(0, VISIBLES);
  const resto = anotadas.length - VISIBLES;

  const handleSacar = (a: Anotada) => {
    const nombre = a.nombre ?? "esta clienta";
    if (!window.confirm(`¿Sacar a ${nombre} de esta clase?`)) return;
    sacar.mutate(a.appointmentId);
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
                  aria-label={`Sacar a ${nombre} de esta clase`}
                  disabled={sacar.isPending}
                  onClick={() => handleSacar(a)}
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
      {sacar.error && <ErrorNote message={(sacar.error as Error).message} />}
    </div>
  );
}
