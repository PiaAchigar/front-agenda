import { useState, type ReactNode } from "react";
import { useCuentaDeBaja, useDarDeBaja, type CuentaDeBaja } from "../../api/grupal";
import { Button, ErrorNote, Input, Modal } from "../../components/ui";
import { pesos } from "../../lib/vender";

/**
 * Dar de baja a una clienta de una capacitación: la saca de todos los
 * encuentros que quedan y resuelve la compra (regla de Pia, 2026-10-21).
 *
 * - Antes del primer encuentro no hay nada que decidir: se cancela la compra
 *   y lo pagado queda a favor.
 * - Ya empezada, Laura ve la cuenta —lo que corresponde por los encuentros
 *   que pasaron contra lo que pagó— y ajusta el resultado: saldo a favor si
 *   pagó de más, lo que queda debiendo si pagó de menos.
 */
export function DarDeBajaModal({
  trainingId,
  customerId,
  nombre,
  onClose,
}: {
  trainingId: string;
  customerId: string;
  nombre: string;
  onClose: () => void;
}) {
  const cuenta = useCuentaDeBaja(trainingId, customerId);
  const baja = useDarDeBaja();

  return (
    <Modal open onClose={onClose} title="Dar de baja de la capacitación">
      <div className="space-y-4">
        <p className="text-sm text-ink">
          Se saca a <span className="font-medium">{nombre}</span> de todos los encuentros que quedan.
        </p>
        {cuenta.error ? (
          <ErrorNote message={(cuenta.error as Error).message} />
        ) : !cuenta.data ? (
          <p className="text-sm text-ink-soft">Haciendo la cuenta…</p>
        ) : (
          <Contenido
            key={cuenta.data.compraId}
            c={cuenta.data}
            error={baja.error ? (baja.error as Error).message : null}
            enviando={baja.isPending}
            onCancelar={onClose}
            onConfirmar={(monto) =>
              baja.mutate({ trainingId, customerId, ...monto }, { onSuccess: onClose })
            }
          />
        )}
      </div>
    </Modal>
  );
}

function Contenido({
  c,
  error,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  c: CuentaDeBaja;
  error: string | null;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: (monto: { saldoAFavor?: number; debe?: number }) => void;
}) {
  // Pagó lo que corresponde o más: el resultado es saldo a favor (puede ser $0).
  const aFavor = c.pagado >= c.corresponde;
  const tope = aFavor ? c.pagado : Math.max(0, c.precio - c.pagado);
  const [monto, setMonto] = useState(aFavor ? c.sugerido.saldoAFavor : c.sugerido.debe);
  const fueraDeRango = c.empezo && (monto < 0 || monto > tope);

  const pie = (
    <>
      {error && <ErrorNote message={error} />}
      <div className="flex justify-end gap-2 border-t border-surface-high pt-3">
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={enviando || fueraDeRango}
          onClick={() => onConfirmar(!c.empezo ? {} : aFavor ? { saldoAFavor: monto } : { debe: monto })}
        >
          {enviando ? "Dando de baja…" : "Dar de baja"}
        </Button>
      </div>
    </>
  );

  if (!c.empezo) {
    return (
      <>
        <div className="rounded-xl bg-surface-high/50 p-3 text-sm text-ink">
          <p>Todavía no empezó: se cancela la compra.</p>
          <p className="mt-1 text-ink-soft">
            {c.pagado > 0
              ? `Los ${pesos(c.pagado)} que pagó quedan como saldo a favor.`
              : "No queda debiendo nada."}
          </p>
        </div>
        {pie}
      </>
    );
  }

  const marcadas = [c.vino > 0 && `vino a ${c.vino}`, c.falto > 0 && `faltó a ${c.falto}`].filter(Boolean).join(", ");
  return (
    <>
      <dl className="space-y-1.5 rounded-xl bg-surface-high/50 p-3 text-sm">
        <Fila nombre="Precio de la capacitación" valor={pesos(c.precio)} />
        <Fila
          nombre="Encuentros"
          valor={`${c.encuentrosTotales} · ya pasaron ${c.encuentrosPasados}${marcadas ? ` (${marcadas})` : ""}`}
        />
        <Fila nombre="Corresponde por los que pasaron" valor={pesos(c.corresponde)} />
        <Fila nombre="Pagó" valor={pesos(c.pagado)} />
      </dl>
      <p className="text-xs text-ink-soft">
        Lo que corresponde es el precio repartido entre los encuentros que ya pasaron; las faltas cuentan.
        {aFavor ? " Pagó de más: la diferencia queda a su favor." : " Pagó de menos: la diferencia queda como deuda."}
        {" "}Ajustalo si hace falta.
      </p>
      <div>
        <Input
          label={aFavor ? "Saldo a favor" : "Queda debiendo"}
          type="number"
          min={0}
          max={tope}
          value={monto}
          onChange={(e) => setMonto(Number(e.target.value) || 0)}
        />
        {fueraDeRango && <p className="mt-1 text-xs text-red-700">Va de $0 a {pesos(tope)}.</p>}
        <p className="mt-1 text-xs text-ink-soft">
          {aFavor
            ? "Se cancela la compra y este monto queda como saldo a favor."
            : monto > 0
              ? "La compra queda cerrada con esta deuda: se cobra desde el CRM o desde un turno suyo."
              : "Se cancela la compra y no queda debiendo nada."}
        </p>
      </div>
      {pie}
    </>
  );
}

function Fila({ nombre, valor }: { nombre: string; valor: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{nombre}</dt>
      <dd className="text-right font-medium text-ink">{valor}</dd>
    </div>
  );
}
