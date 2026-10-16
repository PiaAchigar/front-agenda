import { type ReactNode, useMemo, useState } from "react";
import type { Customer } from "../../api/types";
import { type ItemDeCatalogo, type PromoVendible, useCatalogoVendible, useCotizacion, useVender } from "../../api/ventas";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { CustomerPicker, type NewApptPrefill } from "../day-view/NewAppointmentModal";
import type { Hueco } from "../../lib/que-va-en-el-turno";
import {
  CLAVE_PROMOS,
  areasParaVender,
  claveDeItem,
  esPaquete,
  itemsDeUnaPromo,
  itemsDelArea,
  minutosDe,
  pedidoDeCotizacion,
  pesos,
  promosQueAplican,
  saldoQueEntra,
  sesionesEditables,
} from "../../lib/vender";
import { AVISO_HORARIO_PASADO, yaPaso } from "../../lib/horario";
import { DespuesDeVender } from "./DespuesDeVender";

export type TraspasoAAgendar = { date: string; prefill: NewApptPrefill };

const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * La solapa "Vender y agendar" de Nuevo turno (spec 2026-10-16).
 *
 * Elige y vende. No calcula plata (cotiza la API) ni agenda (eso lo hace la
 * solapa Agendar de siempre, a la que se le pasa la compra al final).
 */
export function VenderYAgendar({
  date,
  hueco,
  solapas,
  onClose,
  onAgendar,
}: {
  date: string;
  hueco: Hueco;
  solapas: ReactNode;
  onClose: () => void;
  onAgendar: (t: TraspasoAAgendar) => void;
}) {
  const { data: catalogo, isLoading, error: errorCatalogo } = useCatalogoVendible();
  const vender = useVender();

  const [fecha, setFecha] = useState(date);
  const [hora, setHora] = useState(aHora(hueco.minutes ?? 9 * 60));
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [area, setArea] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [item, setItem] = useState<ItemDeCatalogo | null>(null);
  const [sesiones, setSesiones] = useState(1);
  // Lo que se ve escrito: puede estar vacío o a medias; `sesiones` (lo que se
  // cotiza) sólo toma enteros >= 1.
  const [sesionesTxt, setSesionesTxt] = useState("1");
  function fijarSesiones(n: number) {
    setSesiones(n);
    setSesionesTxt(String(n));
  }
  const [promotionId, setPromotionId] = useState<string | null>(null);
  const [paquete, setPaquete] = useState<PromoVendible | null>(null);
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [vendida, setVendida] = useState<{ compraId: string; descripcion: string } | null>(null);
  const [avisoDeCierre, setAvisoDeCierre] = useState(false);

  /** Todo lo que depende de lo elegido vuelve a cero (Review Focus 4). */
  function limpiarEleccion() {
    setItem(null);
    fijarSesiones(1);
    setPromotionId(null);
    setPaquete(null);
    setUsarSaldo(false);
  }

  const horarioPasado = Boolean(fecha && hora) && yaPaso(fecha, minutosDe(hora));

  const pedido = pedidoDeCotizacion({ customerId: customer?.id ?? null, paquete, item, sesiones, promotionId });
  const cotizacion = useCotizacion(pedido);
  const q = pedido ? cotizacion.data : undefined;

  const saldo = Number(customer?.creditBalance ?? 0);
  const conSaldo = q && usarSaldo ? saldoQueEntra(q.finalAmount, saldo) : 0;

  const areas = useMemo(() => (catalogo ? areasParaVender(catalogo) : []), [catalogo]);
  const grupos = useMemo(
    () => (catalogo && area && area !== CLAVE_PROMOS ? itemsDelArea(catalogo, area, busqueda) : []),
    [catalogo, area, busqueda],
  );
  const promosDelItem = catalogo ? promosQueAplican(catalogo.promociones, item) : [];
  const promoElegidaEnPromos = area === CLAVE_PROMOS ? catalogo?.promociones.find((p) => p.id === promotionId) ?? null : null;

  function cerrar() {
    // Después de vender, cerrar no puede ser silencioso: la compra existe.
    if (vendida && !avisoDeCierre) setAvisoDeCierre(true);
    else onClose();
  }

  function handleVender() {
    if (!q || !customer) return;
    vender.mutate(
      { ...q, customerId: customer.id, usarSaldo: conSaldo },
      { onSuccess: (r) => setVendida({ compraId: r.id, descripcion: q.description }) },
    );
  }

  const field = "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";
  const label = "mb-1 block text-xs font-medium text-ink-soft";

  if (vendida && customer) {
    return (
      <Modal open onClose={cerrar} title="Nuevo turno">
        {avisoDeCierre ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              La venta quedó en la ficha de {customer.name ?? "la clienta"} como “A agendar”.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAvisoDeCierre(false)}>Volver</Button>
              <Button type="button" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <DespuesDeVender
            compraId={vendida.compraId}
            customerId={customer.id}
            customerName={customer.name ?? "la clienta"}
            descripcion={vendida.descripcion}
            fecha={fecha}
            hueco={{ ...hueco, minutes: minutosDe(hora) }}
            onAgendar={onAgendar}
            onCerrar={cerrar}
          />
        )}
      </Modal>
    );
  }

  return (
    <Modal open onClose={cerrar} title="Nuevo turno">
      {solapas}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Día</span>
            <input type="date" aria-label="Día" className={field} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Hora</span>
            <input type="time" aria-label="Hora" className={field} value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>
        {horarioPasado && <p className="text-xs text-red-700">{AVISO_HORARIO_PASADO}</p>}
        {hueco.providerName && <p className="text-xs text-ink-soft">Profesional: {hueco.providerName}</p>}

        <div>
          <span className={label}>Cliente</span>
          <CustomerPicker
            value={customer}
            onChange={(c) => {
              setCustomer(c);
              limpiarEleccion();
            }}
          />
        </div>

        {isLoading && <p className="text-xs text-ink-soft">Cargando lo que se puede vender…</p>}
        {errorCatalogo && <ErrorNote message={`No se pudo cargar lo que se puede vender: ${(errorCatalogo as Error).message}`} />}

        <label className="block">
          <span className={label}>Área</span>
          <select
            aria-label="Área"
            className={field}
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setBusqueda("");
              limpiarEleccion();
            }}
          >
            <option value="">Elegí un área…</option>
            {areas.map((a) => (
              <option key={a.clave} value={a.clave}>{a.nombre}</option>
            ))}
          </select>
        </label>

        {area && area !== CLAVE_PROMOS && (
          <>
            <input aria-label="Buscar" placeholder="Buscar por nombre…" className={field} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <label className="block">
              <span className={label}>Qué</span>
              <select
                aria-label="Qué"
                className={field}
                value={item ? claveDeItem(item) : ""}
                onChange={(e) => {
                  const elegido = grupos.flatMap((g) => g.items).find((i) => claveDeItem(i) === e.target.value) ?? null;
                  limpiarEleccion();
                  setItem(elegido);
                }}
              >
                <option value="">Elegí qué vender…</option>
                {grupos.map((g) => (
                  <optgroup key={g.titulo} label={g.titulo}>
                    {g.items.map((i) => (
                      <option key={claveDeItem(i)} value={claveDeItem(i)}>{`${i.nombre} · desde ${pesos(i.precioDesde)}`}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {item && sesionesEditables(item) && (
              <label className="block">
                <span className={label}>Sesiones</span>
                <input type="number" min={1} aria-label="Sesiones" className={field} step={1} value={sesionesTxt}
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
                <span className={label}>Promo</span>
                <select aria-label="Promo" className={field} value={promotionId ?? ""} onChange={(e) => setPromotionId(e.target.value || null)}>
                  <option value="">Sin promo</option>
                  {promosDelItem.map((p) => (
                    <option key={p.id} value={p.id}>{p.name ?? "Promo"}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        {area === CLAVE_PROMOS && catalogo && (
          <>
            <label className="block">
              <span className={label}>Promo</span>
              <select
                aria-label="Promo"
                className={field}
                value={paquete?.id ?? promotionId ?? ""}
                onChange={(e) => {
                  const p = catalogo.promociones.find((x) => x.id === e.target.value) ?? null;
                  limpiarEleccion();
                  if (p && esPaquete(p)) setPaquete(p);
                  else setPromotionId(p?.id ?? null);
                }}
              >
                <option value="">Elegí una promo…</option>
                {catalogo.promociones.map((p) => (
                  <option key={p.id} value={p.id}>{`${p.name ?? "Promo"}${esPaquete(p) ? " (paquete)" : ""}`}</option>
                ))}
              </select>
            </label>
            {promoElegidaEnPromos && !esPaquete(promoElegidaEnPromos) && (
              <label className="block">
                <span className={label}>Qué</span>
                <select
                  aria-label="Qué"
                  className={field}
                  value={item ? claveDeItem(item) : ""}
                  onChange={(e) => {
                    const elegido = itemsDeUnaPromo(promoElegidaEnPromos, catalogo).find((i) => claveDeItem(i) === e.target.value) ?? null;
                    setItem(elegido);
                    fijarSesiones(1);
                  }}
                >
                  <option value="">¿A qué se le aplica?</option>
                  {itemsDeUnaPromo(promoElegidaEnPromos, catalogo).map((i) => (
                    <option key={claveDeItem(i)} value={claveDeItem(i)}>{i.nombre}</option>
                  ))}
                </select>
              </label>
            )}
          </>
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
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!q || !fecha || !hora || horarioPasado || vender.isPending} onClick={handleVender}>
            {vender.isPending ? "Vendiendo…" : "Vender"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
