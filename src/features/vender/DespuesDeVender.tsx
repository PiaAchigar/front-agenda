import { useEffect, useState } from "react";
import { useServicesByProvider } from "../../api/agenda";
import { useCompraDeCliente, useEstadoDeCobro } from "../../api/ventas";
import { Button, ErrorNote } from "../../components/ui";
import {
  type Hueco,
  type OpcionParaElTurno,
  laHace,
  opcionesParaElTurno,
  prefillDeTraspaso,
  preseleccion,
} from "../../lib/que-va-en-el-turno";
import { pesos } from "../../lib/vender";
import { CobrarPaso } from "./CobrarPaso";
import type { TraspasoAAgendar } from "./VenderYAgendar";

export type DespuesDeVenderProps = {
  compraId: string;
  customerId: string;
  customerName: string;
  descripcion: string;
  fecha: string;
  hueco: Hueco;
  onAgendar: (t: TraspasoAAgendar) => void;
  onCerrar: () => void;
};

type Paso = "cobro" | "deuda" | "que-va";

/**
 * Lo que pasa después de vender (spec 2026-10-16): cobrar (o no), avisar si
 * queda deuda, elegir qué va en este turno y pasarle todo a "Agendar".
 */
export function DespuesDeVender(p: DespuesDeVenderProps) {
  const estado = useEstadoDeCobro(p.compraId);
  const compra = useCompraDeCliente(p.customerId, p.compraId);
  const { data: serviciosDeElla } = useServicesByProvider(p.hueco.providerId ?? null);
  // Mientras llegan sus servicios no sabemos qué hace: no decidir nada todavía.
  const cargandoSuyos = !!p.hueco.providerId && serviciosDeElla === undefined;
  const suyos = p.hueco.providerId ? (serviciosDeElla ?? []).map((s) => s.id) : null;

  const [paso, setPaso] = useState<Paso | null>(null);
  const [deuda, setDeuda] = useState(0);
  const [elegida, setElegida] = useState<string | null>(null);

  // Primer paso, según lo que diga la API: si no hay nada que cobrar (el
  // saldo a favor cubrió todo), Cobrar no aparece (Review Focus 1).
  if (paso === null && estado.data) setPaso(estado.data.pendiente > 0 ? "cobro" : "que-va");

  const opciones: OpcionParaElTurno[] = compra.data ? opcionesParaElTurno(compra.data) : [];
  const [preseleccionHecha, setPreseleccionHecha] = useState(false);
  if (paso === "que-va" && compra.data && !cargandoSuyos && !preseleccionHecha) {
    setPreseleccionHecha(true);
    setElegida(preseleccion(opciones, suyos));
  }

  function traspasar(clave: string | null) {
    const opcion = opciones.find((o) => o.clave === clave);
    if (!opcion) return;
    p.onAgendar({
      date: p.fecha,
      prefill: prefillDeTraspaso({ opcion, compraId: p.compraId, customerId: p.customerId, hueco: p.hueco, serviciosDeLaProfesional: suyos }),
    });
  }

  // Una sola opción: el paso "¿qué va?" no aparece, se traspasa directo.
  // Efecto y no render: `onAgendar` actualiza el estado del padre.
  const unica = paso === "que-va" && !cargandoSuyos && opciones.length === 1 ? opciones[0]!.clave : null;
  useEffect(() => {
    if (unica) traspasar(unica);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unica]);

  if (estado.error || compra.error) {
    const error = (estado.error ?? compra.error) as Error;
    return (
      <div className="space-y-3">
        <ErrorNote message={`La venta quedó hecha, pero no se pudo seguir: ${error.message}`} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={p.onCerrar}>Cerrar</Button>
          <Button type="button" onClick={() => { estado.refetch(); compra.refetch(); }}>Reintentar</Button>
        </div>
      </div>
    );
  }

  if (paso === null) return <p className="text-sm text-ink-soft">Cargando…</p>;

  if (paso === "cobro" && estado.data) {
    return (
      <CobrarPaso
        compraId={p.compraId}
        descripcion={p.descripcion}
        pendiente={estado.data.pendiente}
        minimo={estado.data.minimo}
        onCobrado={(restante) => {
          if (restante > 0) {
            setDeuda(restante);
            setPaso("deuda");
          } else setPaso("que-va");
        }}
        onDespues={() => {
          setDeuda(estado.data!.pendiente);
          setPaso("deuda");
        }}
      />
    );
  }

  if (paso === "deuda") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Queda debiendo {pesos(deuda)}. Lo vas a ver en la ficha de la clienta.
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={() => setPaso("que-va")}>Seguir</Button>
        </div>
      </div>
    );
  }

  // paso === "que-va"
  if (!compra.data || cargandoSuyos) return <p className="text-sm text-ink-soft">Cargando…</p>;
  if (opciones.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">No queda nada para agendar de esta compra. Quedó en la ficha de {p.customerName}.</p>
        <div className="flex justify-end">
          <Button type="button" onClick={p.onCerrar}>Cerrar</Button>
        </div>
      </div>
    );
  }
  if (opciones.length === 1) return <p className="text-sm text-ink-soft">Abriendo el turno…</p>;

  return (
    <div className="space-y-3">
      <h4 className="text-lg font-semibold text-ink">¿Qué va en este turno?</h4>
      <p className="text-xs text-ink-soft">Lo demás queda “A agendar” en la ficha de {p.customerName}.</p>
      <div className="space-y-1.5 rounded-xl border border-surface-highest bg-white px-3 py-2">
        {opciones.map((o) => (
          <label key={o.clave} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-low">
            <input type="radio" name="que-va" className="mt-1" checked={elegida === o.clave} onChange={() => setElegida(o.clave)} />
            <span className="text-sm text-ink">
              {o.nombre}
              {!laHace(o, suyos) && (
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {p.hueco.providerName ?? "Esta profesional"} no hace este servicio
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="button" disabled={!elegida} onClick={() => traspasar(elegida)}>Agendar</Button>
      </div>
    </div>
  );
}
