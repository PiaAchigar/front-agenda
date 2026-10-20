import { useState } from "react";
import { useCobrarCuota, useCuotaDelMes } from "../../api/grupal";
import type { MedioDePago } from "../../api/ventas";
import { Button, ErrorNote } from "../../components/ui";
import { pesos } from "../../lib/vender";
import { MEDIOS } from "../vender/CobrarPaso";

/** "2026-10" → "octubre". */
export function mesEnLetras(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
}

/**
 * Cobro de la cuota mensual de una actividad. Mismo layout que `CobrarPaso`,
 * pero sin mínimo: la cuota se puede pagar en partes. Nada se calcula acá:
 * cuota, pagado y debe vienen de la API.
 */
export function CobrarCuota({
  subscriptionId,
  mes,
  descripcion,
  onCobrado,
  onCerrar,
}: {
  subscriptionId: string;
  mes: string;
  descripcion: string;
  /** Cobró: cuánto quedó debiendo de la cuota después de este pago. */
  onCobrado: (debeRestante: number) => void;
  onCerrar: () => void;
}) {
  const cuota = useCuotaDelMes(subscriptionId, mes);
  if (cuota.error) {
    return (
      <div className="space-y-2">
        <ErrorNote message={`No se pudo leer la cuota: ${(cuota.error as Error).message}`} />
        <Button type="button" variant="secondary" onClick={onCerrar}>Cerrar</Button>
      </div>
    );
  }
  if (!cuota.data) return <p className="text-sm text-ink-soft">Cargando la cuota…</p>;
  if (cuota.data.debe <= 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">{descripcion}</p>
        <p className="text-sm text-ink">La cuota de {mesEnLetras(mes)} ya está paga.</p>
        <div className="flex justify-end border-t border-surface-high pt-3">
          <Button type="button" variant="secondary" onClick={onCerrar}>Cerrar</Button>
        </div>
      </div>
    );
  }
  return (
    <Formulario
      key={cuota.data.debe}
      subscriptionId={subscriptionId}
      mes={mes}
      descripcion={descripcion}
      cuota={cuota.data.cuota}
      pagado={cuota.data.pagado}
      debe={cuota.data.debe}
      onCobrado={onCobrado}
      onCerrar={onCerrar}
    />
  );
}

function Formulario({
  subscriptionId, mes, descripcion, cuota, pagado, debe, onCobrado, onCerrar,
}: {
  subscriptionId: string; mes: string; descripcion: string;
  cuota: number; pagado: number; debe: number;
  onCobrado: (debeRestante: number) => void; onCerrar: () => void;
}) {
  const cobrar = useCobrarCuota();
  const [monto, setMonto] = useState(debe);
  const [method, setMethod] = useState<MedioDePago>("cash");
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const sobra = monto > debe;
  const invalido = monto <= 0 || sobra;
  const field = "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-lg font-semibold text-ink">Cobrar la cuota</h4>
        <p className="text-sm text-ink-soft">{descripcion}</p>
      </div>

      <div className="rounded-xl bg-surface-high/50 p-3 text-sm">
        <div className="flex justify-between text-ink-soft">
          <span>Cuota de {mesEnLetras(mes)}</span>
          <span>{pesos(cuota)}</span>
        </div>
        <div className="flex justify-between text-ink-soft">
          <span>Pagado</span>
          <span>{pesos(pagado)}</span>
        </div>
        <div className="flex justify-between font-semibold text-ink">
          <span>Debe</span>
          <span>{pesos(debe)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="!px-3 !py-1 text-xs" onClick={() => setMonto(debe)}>
          Todo · {pesos(debe)}
        </Button>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Monto</span>
        <input type="number" aria-label="Monto" className={field} value={monto} onChange={(e) => setMonto(Number(e.target.value) || 0)} />
      </label>
      {sobra && <p className="text-xs text-red-700">No se puede cobrar más de {pesos(debe)}, que es lo que debe.</p>}

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

      {cobrar.error && <ErrorNote message={(cobrar.error as Error).message} />}

      <div className="flex justify-end gap-2 border-t border-surface-high pt-3">
        <Button type="button" variant="secondary" onClick={onCerrar} disabled={cobrar.isPending}>
          Cobrar después
        </Button>
        <Button
          type="button"
          disabled={invalido || cobrar.isPending}
          onClick={() =>
            cobrar.mutate(
              { subscriptionId, mes, amount: monto, method, wantsInvoice },
              { onSuccess: (r) => onCobrado(r.cuota.debe) },
            )
          }
        >
          {cobrar.isPending ? "Cobrando…" : `Cobrar ${pesos(monto)}`}
        </Button>
      </div>
    </div>
  );
}
