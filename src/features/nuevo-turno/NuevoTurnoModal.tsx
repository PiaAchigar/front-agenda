import { useMemo, useState } from "react";
import { useCustomer, useParaAgendar, useServicesByProvider } from "../../api/agenda";
import type { Customer } from "../../api/types";
import { useCatalogoVendible, useComprasDeCliente } from "../../api/ventas";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { AVISO_HORARIO_PASADO, yaPaso } from "../../lib/horario";
import type { Hueco } from "../../lib/que-va-en-el-turno";
import {
  type EleccionDeQue,
  type LineaDisponible,
  areasDelTurno,
  gruposDeQue,
  modoDelTurno,
  sinUsarDeLoMismo,
} from "../../lib/que-ofrecer";
import { CLAVE_SIN_AREA, minutosDe } from "../../lib/vender";
import { CustomerPicker, FormularioAgendar, type NewApptPrefill } from "../day-view/NewAppointmentModal";
import { DespuesDeVender } from "../vender/DespuesDeVender";
import { type EleccionVendible, FormularioVender, type TraspasoAAgendar } from "../vender/FormularioVender";
import { EleccionDelTurno, claveDeEleccion } from "./EleccionDelTurno";

const FIELD = "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const LABEL = "mb-1 block text-xs font-medium text-ink-soft";

const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Lo que falta resolver contra el catálogo / las compras para dejar una elección puesta. */
type Pendiente =
  | { tipo: "servicio"; serviceId: string }
  | { tipo: "linea"; purchaseServiceId: string }
  | { tipo: "linea-de-compra"; compraId: string; serviceId: string };

function pendienteDe(p: NewApptPrefill | null): Pendiente | null {
  if (!p) return null;
  if (p.purchaseServiceId) return { tipo: "linea", purchaseServiceId: p.purchaseServiceId };
  if (p.serviceId && p.compraPreferidaId) return { tipo: "linea-de-compra", compraId: p.compraPreferidaId, serviceId: p.serviceId };
  if (p.serviceId) return { tipo: "servicio", serviceId: p.serviceId };
  return null;
}

/**
 * El único "Nuevo turno" de la agenda (spec 2026-10-19 §4): sin solapas.
 * Día, Hora, Clienta, Área y Qué; lo que sigue depende de lo elegido:
 * agendar (cuerpo de siempre) o vender y agendar (cuerpo de Vender).
 *
 * Los cuerpos guardan estado propio de lo elegido: se remontan con una `key`
 * cuando cambian la clienta, el Qué, el día o la prestadora fija.
 */
export function NuevoTurnoModal({
  date,
  prefill,
  onClose,
  onCambiarDia,
}: {
  date: string;
  prefill: NewApptPrefill | null;
  onClose: () => void;
  /** Se vendió y se agenda en otro día que el de la grilla: la grilla lo sigue. */
  onCambiarDia?: (date: string) => void;
}) {
  const { data: catalogo, isLoading, error: errorCatalogo } = useCatalogoVendible();

  // "A agendar" del CRM sin hueco arranca sin día: el cuerpo de Agendar
  // elige el primer día libre y lo avisa para acá.
  const [fecha, setFecha] = useState(prefill?.customerId && prefill.minutes == null ? "" : date);
  const [hora, setHora] = useState(prefill?.minutes != null ? aHora(prefill.minutes) : "");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [area, setArea] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [eleccion, setEleccion] = useState<EleccionDeQue | null>(null);
  const [cuando, setCuando] = useState<"ahora" | "en-el-turno">("en-el-turno");
  // El servicio que vino cargado desde un hueco de la búsqueda no depende de
  // la clienta: elegirla no lo borra. Cualquier elección a mano lo suelta.
  const [servicioDelHueco, setServicioDelHueco] = useState(false);
  const [prestadora, setPrestadora] = useState<{ providerId?: string; providerName?: string }>({
    providerId: prefill?.providerId,
    providerName: prefill?.providerName,
  });
  const [pendiente, setPendiente] = useState<Pendiente | null>(() => pendienteDe(prefill));
  const [vendida, setVendida] = useState<{ compraId: string; descripcion: string } | null>(null);
  const [avisoDeCierre, setAvisoDeCierre] = useState(false);

  // La clienta que manda "A agendar" (CRM) viene como id: se carga una vez.
  const { data: clienteDePrefill } = useCustomer(prefill?.customerId ?? null);
  const [clienteAplicado, setClienteAplicado] = useState(false);
  if (!clienteAplicado && clienteDePrefill) {
    setClienteAplicado(true);
    setCustomer(clienteDePrefill);
  }

  const comprasQ = useComprasDeCliente(customer?.id ?? null);
  const compras = customer ? (comprasQ.data ?? null) : null;

  /** Todo lo que depende de lo elegido vuelve a cero (Review Focus 4). */
  function limpiarEleccion() {
    setEleccion(null);
    setCuando("en-el-turno");
    setServicioDelHueco(false);
  }

  // Poner la elección que pidió el prefill (o el traspaso de una venta) apenas
  // se puede resolver; si no aparece, se suelta: nada queda esperando.
  if (pendiente && catalogo) {
    if (pendiente.tipo === "servicio") {
      setPendiente(null);
      const item = catalogo.servicios.find((s) => s.id === pendiente.serviceId);
      const clave = item ? (item.area?.id ?? CLAVE_SIN_AREA) : null;
      if (item && clave && areasDelTurno(catalogo).some((a) => a.clave === clave)) {
        setArea(clave);
        setEleccion({ tipo: "servicio", item });
        setServicioDelHueco(true);
      }
    } else if (comprasQ.isError) {
      setPendiente(null);
    } else if (compras) {
      let encontrada = false;
      for (const a of areasDelTurno(catalogo)) {
        const opcion = gruposDeQue(catalogo, compras, a.clave, "")
          .find((g) => g.titulo === "Ya comprado")
          ?.opciones.find(
            (o) =>
              o.tipo === "comprado" &&
              (pendiente.tipo === "linea"
                ? o.linea.purchaseServiceId === pendiente.purchaseServiceId
                : o.linea.compraId === pendiente.compraId && o.linea.serviceId === pendiente.serviceId),
          );
        if (opcion) {
          setArea(a.clave);
          setEleccion(opcion);
          encontrada = true;
          break;
        }
      }
      // Recién vendida: la lista cacheada puede no traerla todavía. Mientras se
      // vuelve a pedir, se espera; si ya no hay nada en camino, se suelta.
      if (encontrada || !comprasQ.isFetching) setPendiente(null);
    }
  }

  const minutos = hora ? minutosDe(hora) : null;
  const horarioPasado = Boolean(fecha) && minutos !== null && yaPaso(fecha, minutos);
  const hueco: Hueco = { ...prestadora, minutes: minutos ?? undefined };

  const grupos = useMemo(
    () => (catalogo && area ? gruposDeQue(catalogo, compras, area, busqueda) : []),
    [catalogo, compras, area, busqueda],
  );
  const modo = eleccion ? modoDelTurno(eleccion, cuando) : null;
  const yaTiene = eleccion && compras ? sinUsarDeLoMismo(eleccion, compras) : [];

  // La prestadora del hueco sólo queda fija si hace lo que se agenda: fijar
  // una que no lo ofrece trabaría el turno (mismo criterio que `laHace`).
  const suyos = useServicesByProvider(prestadora.providerId ?? null);
  const lineaDepi = eleccion?.tipo === "comprado" && eleccion.linea.esDepilacion ? eleccion.linea : null;
  const ancla = useParaAgendar(prestadora.providerId && lineaDepi ? lineaDepi.purchaseServiceId : null);
  const idsSuyos = suyos.isError || !suyos.data ? null : suyos.data.map((s) => s.id);
  const loQueSeAgenda =
    eleccion?.tipo === "comprado"
      ? eleccion.linea.esDepilacion ? (ancla.data?.serviceId ?? null) : eleccion.linea.serviceId
      : eleccion?.tipo === "servicio" ? eleccion.item.id : null;
  const prestadoraFija =
    modo === "agendar" && prestadora.providerId && idsSuyos && loQueSeAgenda && idsSuyos.includes(loQueSeAgenda)
      ? { providerId: prestadora.providerId, providerName: prestadora.providerName }
      : null;
  // El cuerpo toma la prestadora fija al montar: no se monta hasta saber si la hay
  // (si se remontara al resolverse, perdería lo que Laura ya escribió).
  const prestadoraPorSaber = !!prestadora.providerId && (!!suyos.isLoading || (!!lineaDepi && !!ancla.isLoading));
  const cuerpoDeAgendar = eleccion && modo === "agendar" && !prestadoraPorSaber ? eleccion : null;

  function cerrar() {
    // Después de vender, cerrar no puede ser silencioso: la compra existe.
    if (vendida && !avisoDeCierre) setAvisoDeCierre(true);
    else onClose();
  }

  /** Lo vendido pasa a agendar en el mismo modal, con la línea nueva elegida en "Ya comprado". */
  function agendarLoVendido(t: TraspasoAAgendar) {
    if (t.date !== fecha) setFecha(t.date);
    if (t.date !== date) onCambiarDia?.(t.date);
    if (t.prefill.minutes != null) setHora(aHora(t.prefill.minutes));
    setPrestadora({ providerId: t.prefill.providerId, providerName: t.prefill.providerName });
    setVendida(null);
    setAvisoDeCierre(false);
    limpiarEleccion();
    setPendiente(pendienteDe(t.prefill));
  }

  function elegirLinea(l: LineaDisponible) {
    setEleccion({ tipo: "comprado", linea: l });
    setServicioDelHueco(false);
  }

  if (vendida && customer) {
    return (
      <Modal open onClose={cerrar} title="Nuevo turno" altoFijo>
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
            hueco={{ ...prestadora, minutes: minutos ?? undefined }}
            cobrarAhora={cuando === "ahora"}
            onAgendar={agendarLoVendido}
            onCerrar={cerrar}
          />
        )}
      </Modal>
    );
  }

  // El día, la hora y la prestadora fija NO van en la key: si no, el cuerpo se
  // remontaría y perdería notas, zonas y seña.
  const claveCuerpo = `${customer?.id ?? ""}|${eleccion ? claveDeEleccion(eleccion) : ""}`;

  return (
    <Modal open onClose={cerrar} title="Nuevo turno" altoFijo>
      <div className="space-y-4">
        {!cuerpoDeAgendar && (
          <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>Día</span>
              <input type="date" aria-label="Día" className={FIELD} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="block">
              <span className={LABEL}>Hora</span>
              <input type="time" aria-label="Hora" className={FIELD} value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
          </div>
          {horarioPasado && <p className="text-xs text-red-700">{AVISO_HORARIO_PASADO}</p>}
          </>
        )}
        {prestadora.providerName && <p className="text-xs text-ink-soft">Profesional: {prestadora.providerName}</p>}

        <div>
          <span className={LABEL}>Cliente</span>
          <CustomerPicker
            value={customer}
            onChange={(c) => {
              setCustomer(c);
              if (!servicioDelHueco) limpiarEleccion();
              else setCuando("en-el-turno");
            }}
          />
        </div>

        {isLoading && <p className="text-xs text-ink-soft">Cargando lo que se puede agendar…</p>}
        {errorCatalogo && <ErrorNote message={`No se pudo cargar el catálogo: ${(errorCatalogo as Error).message}`} />}

        <EleccionDelTurno
          catalogo={catalogo}
          area={area}
          onArea={(a) => {
            setArea(a);
            setBusqueda("");
            limpiarEleccion();
          }}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          grupos={grupos}
          eleccion={eleccion}
          onEleccion={(e) => {
            setBusqueda("");
            setEleccion(e);
            setServicioDelHueco(false);
          }}
          cuando={cuando}
          onCuando={setCuando}
          yaTiene={yaTiene}
          onElegirLinea={elegirLinea}
        />

        {eleccion && modo === "vender" && (
          <FormularioVender
            key={claveCuerpo}
            eleccion={eleccion as EleccionVendible}
            customer={customer}
            fecha={fecha}
            minutos={minutos}
            hueco={hueco}
            cuando={cuando}
            onVendido={setVendida}
            onCancelar={onClose}
          />
        )}

        {cuerpoDeAgendar && (
          <FormularioAgendar
            key={claveCuerpo}
            prestadoraFija={prestadoraFija}
            onClose={onClose}
            onCambiarFechaHora={(f, m) => {
              setFecha(f);
              setHora(m === null ? "" : aHora(m));
            }}
            encabezado={{
              fecha,
              minutos,
              customer,
              serviceId: cuerpoDeAgendar.tipo === "comprado" ? (cuerpoDeAgendar.linea.esDepilacion ? null : cuerpoDeAgendar.linea.serviceId) : cuerpoDeAgendar.tipo === "servicio" ? cuerpoDeAgendar.item.id : null,
              purchaseServiceId: cuerpoDeAgendar.tipo === "comprado" && cuerpoDeAgendar.linea.esDepilacion ? cuerpoDeAgendar.linea.purchaseServiceId : null,
              compraPreferidaId: cuerpoDeAgendar.tipo === "comprado" && !cuerpoDeAgendar.linea.esDepilacion ? cuerpoDeAgendar.linea.compraId : null,
              compraId: cuerpoDeAgendar.tipo === "comprado" ? cuerpoDeAgendar.linea.compraId : null,
            }}
          />
        )}
      </div>
    </Modal>
  );
}
