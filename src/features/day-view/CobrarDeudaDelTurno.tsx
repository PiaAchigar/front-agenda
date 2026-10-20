import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEstadoDeCobro } from "../../api/ventas";
import { Button, ErrorNote } from "../../components/ui";
import { pesos } from "../../lib/vender";
import { CobrarPaso } from "../vender/CobrarPaso";

/**
 * "Cobrar $X" en el detalle de un turno que sale de una compra con deuda.
 * Cobra sobre la compra (no sobre el turno): es el mismo `CobrarPaso` de
 * Vender. Al terminar se releen los turnos para que el "Debe $X" se actualice.
 */
export function CobrarDeudaDelTurno({ compraId, deuda, descripcion }: { compraId: string; deuda: number; descripcion: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return <Button type="button" onClick={() => setAbierto(true)}>{`Cobrar ${pesos(deuda)}`}</Button>;
  }
  return <CobroAbierto compraId={compraId} descripcion={descripcion} onTerminar={() => setAbierto(false)} />;
}

function CobroAbierto({ compraId, descripcion, onTerminar }: { compraId: string; descripcion: string; onTerminar: () => void }) {
  const qc = useQueryClient();
  const estado = useEstadoDeCobro(compraId);
  if (estado.error) {
    return (
      <div className="w-full space-y-2">
        <ErrorNote message={`No se pudo leer lo que falta cobrar: ${(estado.error as Error).message}`} />
        <Button type="button" variant="secondary" onClick={onTerminar}>Cerrar</Button>
      </div>
    );
  }
  if (!estado.data) return <p className="text-xs text-ink-soft">Cargando lo que falta cobrar…</p>;
  if (estado.data.pendiente <= 0) {
    return (
      <div className="w-full space-y-2">
        <p className="text-xs text-ink-soft">No queda nada por cobrar de esta compra.</p>
        <Button type="button" variant="secondary" onClick={onTerminar}>Cerrar</Button>
      </div>
    );
  }
  return (
    <div className="w-full rounded-xl border border-surface-highest bg-white p-3">
      <CobrarPaso
        compraId={compraId}
        descripcion={descripcion}
        pendiente={estado.data.pendiente}
        minimo={estado.data.minimo}
        onCobrado={() => {
          qc.invalidateQueries({ queryKey: ["appointments"] });
          qc.invalidateQueries({ queryKey: ["appointments-range"] });
          onTerminar();
        }}
        onDespues={onTerminar}
      />
    </div>
  );
}
