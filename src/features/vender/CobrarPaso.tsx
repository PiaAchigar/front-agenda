import { useState } from "react";
import { type MedioDePago, type EstadoDeCobro, useCobrarCompra } from "../../api/ventas";
import { Button, ErrorNote } from "../../components/ui";
import { pesos } from "../../lib/vender";

/**
 * El paso de cobro después de vender desde la agenda.
 *
 * Copia de `front-crm/src/features/compras/CobrarPaso.tsx` con el estilo de
 * la agenda. No calcula plata: `pendiente` y `minimo` vienen de
 * `GET /purchases/:id/checkout-state`, y el cobro va al MISMO `checkout` del
 * mostrador, que resuelve factura ARCA, declarado/no declarado y caja.
 */
const MEDIOS: { valor: MedioDePago; texto: string }[] = [
  { valor: "cash", texto: "Efectivo" },
  { valor: "debit_card", texto: "Débito" },
  { valor: "credit_card", texto: "Crédito" },
  { valor: "bank_transfer", texto: "Transferencia" },
  { valor: "mercadopago", texto: "MercadoPago" },
];

export function CobrarPaso({
  compraId,
  descripcion,
  pendiente,
  minimo,
  onCobrado,
  onDespues,
}: {
  compraId: string;
  descripcion: string;
  pendiente: number;
  minimo: number;
  /** Cobró: cuánto quedó debiendo después de este pago (0 si saldó). */
  onCobrado: (restante: number) => void;
  onDespues: () => void;
}) {
  const cobrar = useCobrarCompra();
  const [monto, setMonto] = useState(pendiente);
  const [method, setMethod] = useState<MedioDePago>("cash");
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const falta = monto < minimo;
  const sobra = monto > pendiente;
  const invalido = monto <= 0 || falta || sobra;

  const field = "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-lg font-semibold text-ink">Cobrar</h4>
        <p className="text-sm text-ink-soft">{descripcion}</p>
      </div>

      <div className="rounded-xl bg-surface-high/50 p-3 text-sm">
        <div className="flex justify-between font-semibold text-ink">
          <span>A cobrar</span>
          <span>{pesos(pendiente)}</span>
        </div>
        {minimo > 0 && <p className="mt-1 text-xs text-ink-soft">Mínimo del primer pago: {pesos(minimo)} (el 40%).</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="!px-3 !py-1 text-xs" onClick={() => setMonto(pendiente)}>
          Todo · {pesos(pendiente)}
        </Button>
        {minimo > 0 && minimo < pendiente && (
          <Button type="button" variant="secondary" className="!px-3 !py-1 text-xs" onClick={() => setMonto(minimo)}>
            Seña 40% · {pesos(minimo)}
          </Button>
        )}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Monto</span>
        <input type="number" aria-label="Monto" className={field} value={monto} onChange={(e) => setMonto(Number(e.target.value) || 0)} />
      </label>
      {falta && <p className="text-xs text-red-700">El primer pago tiene que ser de al menos {pesos(minimo)}.</p>}
      {sobra && <p className="text-xs text-red-700">No se puede cobrar más de {pesos(pendiente)}, que es lo que falta.</p>}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Medio de pago</span>
        <select aria-label="Medio de pago" className={field} value={method} onChange={(e) => setMethod(e.target.value as MedioDePago)}>
          {MEDIOS.map((m) => (
            <option key={m.valor} value={m.valor}>{m.texto}</option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={wantsInvoice} onChange={(e) => setWantsInvoice(e.target.checked)} />
        <span>
          Lleva factura
          <span className="block text-xs text-ink-soft">Emite comprobante por ARCA. Un pago parcial también se puede facturar.</span>
        </span>
      </label>

      {cobrar.error && (
        <ErrorNote message={`La venta quedó hecha, el cobro no: ${(cobrar.error as Error).message}`} />
      )}

      <div className="flex justify-end gap-2 border-t border-surface-high pt-3">
        {/* La venta YA está hecha: esto sólo decide si se cobra ahora. */}
        <Button type="button" variant="secondary" onClick={onDespues} disabled={cobrar.isPending}>
          Cobrar después
        </Button>
        <Button
          type="button"
          disabled={invalido || cobrar.isPending}
          onClick={() =>
            cobrar.mutate(
              { id: compraId, amount: monto, method, wantsInvoice },
              { onSuccess: (r: EstadoDeCobro) => onCobrado(r.pendiente) },
            )
          }
        >
          {cobrar.isPending ? "Cobrando…" : `Cobrar ${pesos(monto)}`}
        </Button>
      </div>
    </div>
  );
}
