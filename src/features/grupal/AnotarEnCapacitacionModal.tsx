import { useState } from "react";
import {
  useAnotarACapacitacion,
  useOpcionesDeCapacitacion,
  type AnotarACapacitacionResultado,
} from "../../api/grupal";
import type { ClassOccurrence, Customer } from "../../api/types";
import { useCatalogoVendible } from "../../api/ventas";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { pesos } from "../../lib/vender";
import { CustomerPicker } from "../day-view/NewAppointmentModal";
import { CobrarLoQueFalta } from "../vender/CobrarLoQueFalta";
import { FormularioVender } from "../vender/FormularioVender";

type Vendido = { compraId: string; descripcion: string };

const encuentros = (n: number) => `${n} ${n === 1 ? "encuentro" : "encuentros"}`;

function Resumen({ r }: { r: AnotarACapacitacionResultado }) {
  const sinLugar = r.sinLugar.length
    ? `Sin lugar en ${r.sinLugar.length === 1 ? "el encuentro" : "los encuentros"} N.º ${r.sinLugar.join(", ")}`
    : null;
  return (
    <div className="space-y-1 text-sm">
      {r.anotada === 0 && r.sinLugar.length > 0 ? (
        <p className="font-medium text-ink">No quedó anotada en ningún encuentro: están todos completos.</p>
      ) : (
        <p className="font-medium text-ink">Quedó anotada en {encuentros(r.anotada)}</p>
      )}
      {sinLugar && <p className="text-amber-700">{sinLugar}</p>}
    </div>
  );
}

/** "Anotar" en un encuentro de capacitación: anota en todos los que quedan, o vende y anota. */
export function AnotarEnCapacitacionModal({ occurrence, onClose }: { occurrence: ClassOccurrence; onClose: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vendido, setVendido] = useState<Vendido | null>(null);
  const anotar = useAnotarACapacitacion();

  const cambiarClienta = (c: Customer | null) => {
    setCustomer(c);
    anotar.reset();
  };

  const cerrar = (
    <div className="flex justify-end border-t border-surface-high pt-3">
      <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
    </div>
  );

  const anotarAhora = (c: Customer, alAnotar?: () => void) =>
    anotar.mutate({ trainingId: occurrence.subjectId, customerId: c.id }, { onSuccess: alAnotar });

  return (
    <Modal open arriba onClose={onClose} title={`Anotar en ${occurrence.name}`}>
      {vendido && customer ? (
        // Anotar va ANTES de cobrar: un cobro postergado nunca deja la venta sin anotar.
        <div className="space-y-3">
          {anotar.isPending && <p className="text-sm text-ink-soft">Anotándola…</p>}
          {anotar.error && (
            <div className="space-y-2">
              <ErrorNote message={`La venta quedó hecha, pero no se pudo anotar: ${(anotar.error as Error).message}`} />
              <Button type="button" onClick={() => anotarAhora(customer)}>Reintentar anotar</Button>
            </div>
          )}
          {anotar.data && (
            <>
              <Resumen r={anotar.data} />
              {/* Trae su propio "Cobrar después" (y "Cerrar" si no queda nada por cobrar). */}
              <CobrarLoQueFalta compraId={vendido.compraId} descripcion={vendido.descripcion} abiertoDeEntrada alCerrar={onClose} />
            </>
          )}
        </div>
      ) : anotar.data && customer ? (
        <div className="space-y-3">
          <Resumen r={anotar.data} />
          {cerrar}
        </div>
      ) : (
        <div className="space-y-3">
          <CustomerPicker value={customer} onChange={cambiarClienta} />
          {customer && (
            <Ofertas
              occurrence={occurrence}
              customer={customer}
              anotar={anotar}
              onAnotar={() => anotarAhora(customer)}
              onVendido={(v) => {
                setVendido(v);
                anotarAhora(customer);
              }}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function Ofertas({
  occurrence, customer, anotar, onAnotar, onVendido,
}: {
  occurrence: ClassOccurrence;
  customer: Customer;
  anotar: ReturnType<typeof useAnotarACapacitacion>;
  onAnotar: () => void;
  onVendido: (v: Vendido) => void;
}) {
  const opciones = useOpcionesDeCapacitacion(occurrence.subjectId, customer.id);
  const { data: catalogo, isLoading: cargandoCatalogo } = useCatalogoVendible();

  if (opciones.error) return <ErrorNote message={(opciones.error as Error).message} />;
  if (!opciones.data) return <p className="text-sm text-ink-soft">Viendo si compró la capacitación…</p>;
  const o = opciones.data;

  if (!o.compraId) {
    if (cargandoCatalogo) return <p className="text-sm text-ink-soft">Cargando el catálogo…</p>;
    const item = catalogo?.capacitaciones.find((c) => c.id === occurrence.subjectId);
    if (!item) return <p className="text-sm text-ink">Esta capacitación no está a la venta en el catálogo.</p>;
    return (
      <FormularioVender
        key={customer.id}
        eleccion={{ tipo: "capacitacion", item }}
        customer={customer}
        fecha={occurrence.date}
        minutos={null}
        sinHorario
        etiqueta="Vender y anotar"
        onVendido={onVendido}
      />
    );
  }

  const cobro = o.debe > 0 && (
    <div className="space-y-2">
      <p className="text-sm text-ink">Debe {pesos(o.debe)}</p>
      <CobrarLoQueFalta compraId={o.compraId} descripcion={`${occurrence.name} · ${customer.name ?? "Sin nombre"}`} />
    </div>
  );

  if (o.encuentrosAnotada === o.encuentrosQueQuedan) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">Ya está anotada en todos los encuentros que quedan.</p>
        {cobro}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        Compró la capacitación · anotada en {o.encuentrosAnotada} de {o.encuentrosQueQuedan} encuentros
      </p>
      {cobro}
      {anotar.error && <ErrorNote message={(anotar.error as Error).message} />}
      <div className="flex justify-end border-t border-surface-high pt-3">
        <Button type="button" disabled={anotar.isPending} onClick={onAnotar}>Anotar en los encuentros</Button>
      </div>
    </div>
  );
}
