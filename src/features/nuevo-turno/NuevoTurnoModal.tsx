import { useMemo, useState } from "react";
import {
  useCustomer,
  useDisponibilidades,
  useOfertaDeProveedora,
  useParaAgendar,
  useProviders,
  useQuienHace,
  useServicesByProvider,
} from "../../api/agenda";
import { gruposDePrestadoras, libertadEnHora, queSeBusca } from "../../lib/prestadoras-de-lo-elegido";
import type { Customer } from "../../api/types";
import { useCatalogoVendible, useComprasDeCliente } from "../../api/ventas";
import { Button, ErrorNote, Modal } from "../../components/ui";
import { AVISO_HORARIO_PASADO, yaPaso } from "../../lib/horario";
import {
  type EleccionDeQue,
  type LineaDisponible,
  areasDelTurno,
  catalogoDeLaPrestadora,
  comprasQueHace,
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
  /** CRM "A agendar": llega sólo clienta + servicio. Si ya lo compró, se agenda esa sesión (no se vende de nuevo). */
  | { tipo: "servicio-de-clienta"; serviceId: string }
  | { tipo: "linea"; purchaseServiceId: string }
  | { tipo: "linea-de-compra"; compraId: string; serviceId: string };

function pendienteDe(p: NewApptPrefill | null): Pendiente | null {
  if (!p) return null;
  if (p.purchaseServiceId) return { tipo: "linea", purchaseServiceId: p.purchaseServiceId };
  if (p.serviceId && p.compraPreferidaId) return { tipo: "linea-de-compra", compraId: p.compraPreferidaId, serviceId: p.serviceId };
  if (p.serviceId && p.customerId) return { tipo: "servicio-de-clienta", serviceId: p.serviceId };
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
  onIrAGrupales,
}: {
  date: string;
  prefill: NewApptPrefill | null;
  onClose: () => void;
  /** Se vendió y se agenda en otro día que el de la grilla: la grilla lo sigue. */
  onCambiarDia?: (date: string) => void;
  /** Anotar en una actividad o capacitación que dicta la prestadora: pasa a Turnos grupales con ese filtro. */
  onIrAGrupales?: (tipo: "actividad" | "capacitacion", id: string, fecha: string) => void;
}) {
  const { data: catalogoCompleto, isLoading, error: errorCatalogo } = useCatalogoVendible();
  const { data: prestadoras = [] } = useProviders();

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

  // Con una prestadora elegida (la del hueco, o la que Laura ponga arriba),
  // Área y Qué muestran sólo lo que ella hace (pedido de Pia, 2026-10-22).
  // Sin oferta todavía, o si la API falla, se muestra todo: nunca se traba.
  const ofertaQ = useOfertaDeProveedora(prestadora.providerId ?? null);
  const oferta = prestadora.providerId ? (ofertaQ.data ?? null) : null;
  const esperandoOferta = !!prestadora.providerId && ofertaQ.isLoading;
  const catalogo = useMemo(
    () => (catalogoCompleto && oferta ? catalogoDeLaPrestadora(catalogoCompleto, oferta) : catalogoCompleto),
    [catalogoCompleto, oferta],
  );
  const comprasVisibles = useMemo(() => (compras && oferta ? comprasQueHace(compras, oferta) : compras), [compras, oferta]);

  /** Todo lo que depende de lo elegido vuelve a cero (Review Focus 4). */
  function limpiarEleccion() {
    setEleccion(null);
    setCuando("en-el-turno");
    setServicioDelHueco(false);
  }

  // Poner la elección que pidió el prefill (o el traspaso de una venta) apenas
  // se puede resolver; si no aparece, se suelta: nada queda esperando.
  if (pendiente && catalogo && !esperandoOferta) {
    const ponerServicio = (serviceId: string) => {
      const item = catalogo.servicios.find((s) => s.id === serviceId);
      const clave = item ? (item.area?.id ?? CLAVE_SIN_AREA) : null;
      if (item && clave && areasDelTurno(catalogo).some((a) => a.clave === clave)) {
        setArea(clave);
        setEleccion({ tipo: "servicio", item });
        setServicioDelHueco(true);
      }
    };
    if (pendiente.tipo === "servicio") {
      setPendiente(null);
      ponerServicio(pendiente.serviceId);
    } else if (comprasQ.isError) {
      setPendiente(null);
      if (pendiente.tipo === "servicio-de-clienta") ponerServicio(pendiente.serviceId);
    } else if (compras) {
      let encontrada = false;
      for (const a of areasDelTurno(catalogo)) {
        // Las sesiones vienen por vencimiento: la primera que coincide es la que usaría `consumible`.
        const opcion = gruposDeQue(catalogo, compras, a.clave, "")
          .find((g) => g.titulo === "Ya comprado")
          ?.opciones.find(
            (o) =>
              o.tipo === "comprado" &&
              (pendiente.tipo === "linea"
                ? o.linea.purchaseServiceId === pendiente.purchaseServiceId
                : pendiente.tipo === "servicio-de-clienta"
                  ? !o.linea.esDepilacion && o.linea.serviceId === pendiente.serviceId
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
      if (encontrada || !comprasQ.isFetching) {
        setPendiente(null);
        // Sin sesión comprada de ese servicio, se ofrece como nuevo.
        if (!encontrada && pendiente.tipo === "servicio-de-clienta") ponerServicio(pendiente.serviceId);
      }
    }
  }

  const minutos = hora ? minutosDe(hora) : null;
  const horarioPasado = Boolean(fecha) && minutos !== null && yaPaso(fecha, minutos);

  const grupos = useMemo(
    () => (catalogo && area ? gruposDeQue(catalogo, comprasVisibles, area, busqueda) : []),
    [catalogo, comprasVisibles, area, busqueda],
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

  // Buscando desde el servicio (spec 2026-10-22-nuevo-turno-filtros-cruzados):
  // con algo elegido que se vende (el encabezado sigue a la vista), Prestadora
  // lista sólo a las que lo hacen, con qué hace cada una y si está libre. Al
  // agendar, eso lo hace el desplegable del cuerpo.
  const queSeVende = eleccion && !cuerpoDeAgendar ? queSeBusca(eleccion) : null;
  const quienHace = useQuienHace(queSeVende);
  const quienes = queSeVende ? (quienHace.data ?? null) : null;
  // "Libre" se mide con el primer servicio que haría cada una (depilación no:
  // su duración sale de las zonas).
  const primeros = useMemo(
    () => (quienes && queSeVende?.tipo !== "depilacion" ? [...new Set(quienes.map((q) => q.serviceIds[0]!).filter(Boolean))] : []),
    [quienes, queSeVende?.tipo],
  );
  const disponibilidades = useDisponibilidades(primeros, fecha && hora ? fecha : null);
  const gruposDeQuienes = quienes
    ? gruposDePrestadoras(
        quienes,
        (q) => {
          const d = disponibilidades.get(q.serviceIds[0] ?? "");
          return d && hora ? libertadEnHora(d.slots, q.providerId, hora) : null;
        },
        hora || null,
      )
    : null;
  // Una sola la hace: queda elegida (una vez por cosa elegida; si Laura vuelve a "Todas", se respeta).
  const claveQue = queSeVende ? `${queSeVende.tipo}:${queSeVende.id}` : "";
  const [autoElegidaPara, setAutoElegidaPara] = useState("");
  if (quienes && quienes.length === 1 && claveQue !== autoElegidaPara) {
    setAutoElegidaPara(claveQue);
    if (!prestadora.providerId) setPrestadora({ providerId: quienes[0]!.providerId, providerName: quienes[0]!.nombre ?? undefined });
  }

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

  function cambiarPrestadora(providerId: string) {
    const p = prestadoras.find((x) => x.id === providerId);
    const q = quienes?.find((x) => x.providerId === providerId);
    setPrestadora(p || q ? { providerId, providerName: p?.fullName ?? q?.nombre ?? undefined } : {});
    // Con algo ya elegido, la lista sólo ofrece a las que lo hacen: lo elegido queda.
    if (eleccion) return;
    setArea("");
    setBusqueda("");
    limpiarEleccion();
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
          <label className="block">
            <span className={LABEL}>Prestadora</span>
            <select
              aria-label="Prestadora"
              className={FIELD}
              value={prestadora.providerId ?? ""}
              onChange={(e) => cambiarPrestadora(e.target.value)}
            >
              <option value="">
                {quienes ? `Todas (${quienes.length} ${quienes.length === 1 ? "lo hace" : "lo hacen"})` : "Todas"}
              </option>
              {gruposDeQuienes ? (
                <>
                  {gruposDeQuienes.map((g) =>
                    g.titulo ? (
                      <optgroup key={g.titulo} label={g.titulo}>
                        {g.opciones.map((o) => <option key={o.providerId} value={o.providerId}>{o.texto}</option>)}
                      </optgroup>
                    ) : (
                      g.opciones.map((o) => <option key={o.providerId} value={o.providerId}>{o.texto}</option>)
                    ),
                  )}
                  {prestadora.providerId && !quienes!.some((q) => q.providerId === prestadora.providerId) && (
                    <option value={prestadora.providerId}>{prestadora.providerName ?? "Prestadora"}</option>
                  )}
                </>
              ) : (
                <>
                  {/* La del hueco aunque no venga en la lista (archivada, o la lista todavía cargando). */}
                  {prestadora.providerId && !prestadoras.some((p) => p.id === prestadora.providerId) && (
                    <option value={prestadora.providerId}>{prestadora.providerName ?? "Prestadora"}</option>
                  )}
                  {prestadoras.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName ?? "Sin nombre"}</option>
                  ))}
                </>
              )}
            </select>
          </label>
          </>
        )}
        {prestadora.providerName && prestadoraFija && cuerpoDeAgendar && <p className="text-xs text-ink-soft">Profesional: {prestadora.providerName}</p>}

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

        {(isLoading || esperandoOferta) && <p className="text-xs text-ink-soft">Cargando lo que se puede agendar…</p>}
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
          oferta={oferta}
          onIrAGrupales={(tipo, id) => {
            onIrAGrupales?.(tipo, id, fecha || date);
            onClose();
          }}
        />

        {eleccion && modo === "vender" && (
          <FormularioVender
            key={claveCuerpo}
            eleccion={eleccion as EleccionVendible}
            customer={customer}
            fecha={fecha}
            minutos={minutos}
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
