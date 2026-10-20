import { useState } from "react";
import type { Customer } from "../../api/types";
import { type ItemDeCatalogo, useCatalogoVendible, useCotizacion, useVender } from "../../api/ventas";
import { Button, ErrorNote } from "../../components/ui";
import type { NewApptPrefill } from "../day-view/NewAppointmentModal";
import type { EleccionDeQue } from "../../lib/que-ofrecer";
import {
  claveDeItem,
  esPaquete,
  itemsDeUnaPromo,
  pedidoDeCotizacion,
  pesos,
  promosQueAplican,
  saldoQueEntra,
  sesionesEditables,
} from "../../lib/vender";
import { yaPaso } from "../../lib/horario";

export type TraspasoAAgendar = { date: string; prefill: NewApptPrefill };

const FIELD = "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const LABEL = "mb-1 block text-xs font-medium text-ink-soft";

/** Lo que se puede vender: `comprado` se agenda, no se vende. */
export type EleccionVendible = Exclude<EleccionDeQue, { tipo: "comprado" }>;

/**
 * El cuerpo de Vender (spec 2026-10-19): sesiones, promos que aplican,
 * cotización, saldo a favor y el botón. Lo de arriba (día, hora, clienta,
 * área y qué) lo dibuja quien lo usa. Guarda estado propio de lo elegido:
 * si `eleccion` o la clienta cambian, quien lo usa lo remonta con una `key`.
 *
 * Qué pasa DESPUÉS de vender (cobrar o no) lo resuelve quien recibe `onVendido`.
 */
export function FormularioVender({
  eleccion,
  customer,
  fecha,
  minutos,
  onVendido,
  onCancelar,
  sinHorario = false,
  etiqueta = "Vender y agendar",
}: {
  /** `null` mientras no se elige nada: no cotiza y el botón queda apagado. */
  eleccion: EleccionVendible | null;
  customer: Customer | null;
  fecha: string;
  /** Minutos desde medianoche, `null` si todavía no hay hora. */
  minutos: number | null;
  onVendido: (v: { compraId: string; descripcion: string }) => void;
  onCancelar?: () => void;
  /** Se vende sin agendar un horario (capacitaciones): no exige fecha ni hora. */
  sinHorario?: boolean;
  /** Texto del botón de vender. */
  etiqueta?: string;
}) {
  const { data: catalogo } = useCatalogoVendible();
  const vender = useVender();

  const [sesiones, setSesiones] = useState(1);
  // Lo que se ve escrito: puede estar vacío o a medias; `sesiones` (lo que se
  // cotiza) sólo toma enteros >= 1.
  const [sesionesTxt, setSesionesTxt] = useState("1");
  const [promoDelItem, setPromoDelItem] = useState<string | null>(null);
  const [itemDeLaPromo, setItemDeLaPromo] = useState<ItemDeCatalogo | null>(null);
  const [usarSaldo, setUsarSaldo] = useState(false);

  // Una promo paquete se vende como ella misma; una de descuento se aplica a
  // un item que se elige acá (el descuento nunca se calcula en el front).
  const promo = eleccion?.tipo === "promo" ? eleccion.promo : null;
  const paquete = promo && esPaquete(promo) ? promo : null;
  const item = !eleccion ? null : eleccion.tipo === "promo" ? (paquete ? null : itemDeLaPromo) : eleccion.item;
  const promotionId = promo ? (paquete ? null : promo.id) : promoDelItem;

  const horarioPasado = !sinHorario && Boolean(fecha) && minutos !== null && yaPaso(fecha, minutos);

  const pedido = pedidoDeCotizacion({ customerId: customer?.id ?? null, paquete, item, sesiones, promotionId });
  const cotizacion = useCotizacion(pedido);
  const q = pedido ? cotizacion.data : undefined;

  const saldo = Number(customer?.creditBalance ?? 0);
  const conSaldo = q && usarSaldo ? saldoQueEntra(q.finalAmount, saldo) : 0;

  const promosDelItem = !promo && catalogo ? promosQueAplican(catalogo.promociones, item) : [];
  const itemsDeLaPromo = promo && !paquete && catalogo ? itemsDeUnaPromo(promo, catalogo) : [];

  function handleVender() {
    if (!q || !customer) return;
    vender.mutate(
      { ...q, customerId: customer.id, usarSaldo: conSaldo },
      { onSuccess: (r) => onVendido({ compraId: r.id, descripcion: q.description }) },
    );
  }

  return (
    <div className="space-y-4">
      {promo && !paquete && (
        <label className="block">
          <span className={LABEL}>{promo.name ?? "Promo"}</span>
          <select
            aria-label="¿A qué se le aplica?"
            className={FIELD}
            value={item ? claveDeItem(item) : ""}
            onChange={(e) => {
              setItemDeLaPromo(itemsDeLaPromo.find((i) => claveDeItem(i) === e.target.value) ?? null);
              setSesiones(1);
              setSesionesTxt("1");
            }}
          >
            <option value="">¿A qué se le aplica?</option>
            {itemsDeLaPromo.map((i) => (
              <option key={claveDeItem(i)} value={claveDeItem(i)}>{i.nombre}</option>
            ))}
          </select>
        </label>
      )}

      {item && sesionesEditables(item) && (
        <label className="block">
          <span className={LABEL}>Sesiones</span>
          <input type="number" min={1} aria-label="Sesiones" className={FIELD} step={1} value={sesionesTxt}
            onChange={(e) => {
              setSesionesTxt(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isInteger(n) && n >= 1) setSesiones(n);
            }}
            onBlur={() => setSesionesTxt(String(sesiones))} />
        </label>
      )}
      {promosDelItem.length > 0 && (
        <label className="block">
          <span className={LABEL}>Promo</span>
          <select aria-label="Promo" className={FIELD} value={promoDelItem ?? ""} onChange={(e) => setPromoDelItem(e.target.value || null)}>
            <option value="">Sin promo</option>
            {promosDelItem.map((p) => (
              <option key={p.id} value={p.id}>{p.name ?? "Promo"}</option>
            ))}
          </select>
        </label>
      )}

      {item && item.desglose.length > 0 && (
        <ul className="rounded-xl bg-surface-high/40 px-3 py-2 text-xs text-ink-soft">
          {item.desglose.map((d) => (
            <li key={d.nombre}>{d.cantidad} × {d.nombre}</li>
          ))}
        </ul>
      )}

      {pedido && cotizacion.isFetching && <p className="text-xs text-ink-soft">Cotizando…</p>}
      {pedido && cotizacion.error && <ErrorNote message={(cotizacion.error as Error).message} />}
      {q && (
        <div className="rounded-xl bg-primary/8 px-3 py-2 text-sm">
          <div className="flex justify-between font-semibold text-ink">
            <span>{q.description}</span>
            <span>{pesos(q.finalAmount)}</span>
          </div>
          {q.baseAmount > q.finalAmount && <p className="text-xs text-ink-soft line-through">{pesos(q.baseAmount)}</p>}
          {q.expiresAt && (
            <p className="text-xs text-ink-soft">Vale hasta el {q.expiresAt.slice(0, 10).split("-").reverse().join("/")}</p>
          )}
        </div>
      )}

      {q && saldo > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={usarSaldo} onChange={(e) => setUsarSaldo(e.target.checked)} />
          <span>Usar saldo a favor ({pesos(saldoQueEntra(q.finalAmount, saldo))})</span>
        </label>
      )}

      {vender.error && <ErrorNote message={(vender.error as Error).message} />}

      <div className="flex justify-end gap-2 border-t border-surface-high pt-3">
        {onCancelar && <Button type="button" variant="secondary" onClick={onCancelar}>Cancelar</Button>}
        <Button type="button" disabled={!q || (!sinHorario && (!fecha || minutos === null)) || horarioPasado || vender.isPending} onClick={handleVender}>
          {vender.isPending ? "Vendiendo…" : etiqueta}
        </Button>
      </div>
    </div>
  );
}
