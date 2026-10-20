import { useState } from "react";
import { useEstadoDeCobro } from "../../api/ventas";
import { Button, ErrorNote } from "../../components/ui";
import { CobrarPaso } from "./CobrarPaso";

/**
 * La salida de la puerta de pago de depilación (#18): si falta plata para
 * agendar, se cobra ahí mismo sobre esa compra. Al cobrar, `useCobrarCompra`
 * invalida `para-agendar` y la puerta se vuelve a leer sola.
 */
export function CobrarLoQueFalta({
  compraId,
  descripcion,
  etiqueta = "Cobrar lo que falta",
  variante = "secondary",
  alCobrar,
  abiertoDeEntrada = false,
  alCerrar,
}: {
  compraId: string;
  descripcion: string;
  /** Texto del botón (el detalle del turno dice "Cobrar $X"). */
  etiqueta?: string;
  variante?: "primary" | "secondary";
  /** Se llama al cobrar, antes de cerrar (el detalle del turno relee los turnos). */
  alCobrar?: () => void;
  /** Arranca con el cobro abierto, sin el botón intermedio (lo usa la agenda grupal). */
  abiertoDeEntrada?: boolean;
  /** Se llama al cerrar el cobro, haya cobrado o no. */
  alCerrar?: () => void;
}) {
  const [abierto, setAbierto] = useState(abiertoDeEntrada);
  if (!abierto) {
    if (abiertoDeEntrada) return null;
    return (
      <Button type="button" variant={variante} onClick={() => setAbierto(true)}>
        {etiqueta}
      </Button>
    );
  }
  return (
    <CobroAbierto
      compraId={compraId}
      descripcion={descripcion}
      onCobrado={() => { alCobrar?.(); setAbierto(false); alCerrar?.(); }}
      onTerminar={() => { setAbierto(false); alCerrar?.(); }}
    />
  );
}

function CobroAbierto({ compraId, descripcion, onCobrado, onTerminar }: { compraId: string; descripcion: string; onCobrado: () => void; onTerminar: () => void }) {
  const estado = useEstadoDeCobro(compraId);
  if (estado.error) {
    return (
      <div className="space-y-2">
        <ErrorNote message={`No se pudo leer lo que falta cobrar: ${(estado.error as Error).message}`} />
        <Button type="button" variant="secondary" onClick={onTerminar}>Cerrar</Button>
      </div>
    );
  }
  if (!estado.data) return <p className="text-xs text-ink-soft">Cargando lo que falta cobrar…</p>;
  if (estado.data.pendiente <= 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-ink-soft">No queda nada por cobrar de esta compra.</p>
        <Button type="button" variant="secondary" onClick={onTerminar}>Cerrar</Button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-surface-highest bg-white p-3">
      <CobrarPaso
        compraId={compraId}
        descripcion={descripcion}
        pendiente={estado.data.pendiente}
        minimo={estado.data.minimo}
        onCobrado={onCobrado}
        onDespues={onTerminar}
      />
    </div>
  );
}
