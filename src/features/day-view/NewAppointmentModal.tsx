import { useEffect, useRef, useState } from "react";
import {
  useConsumible,
  useCreateAppointment,
  useCreateCustomer,
  useCustomerSearch,
  useProvidersByService,
  useServices,
  useServicesByProvider,
  type Consumible,
} from "../../api/agenda";
import type { Customer } from "../../api/types";
import { Button, ErrorNote, Input, Modal } from "../../components/ui";

// ── Helpers ──────────────────────────────────────────────────────────────────

function useDebounced(value: string, ms = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function minToTimeStr(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h = 0, m = 0] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return minToTimeStr(Math.min(total, 23 * 60 + 59));
}

/** Convierte "HH:MM" + fecha YYYY-MM-DD a ISO con offset ART (-03:00). */
function toArgentinaISO(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00-03:00`;
}

// ── Sub-componente: búsqueda / alta de cliente ────────────────────────────────

function CustomerPicker({
  value,
  onChange,
}: {
  value: Customer | null;
  onChange: (c: Customer | null) => void;
}) {
  const [query, setQuery]         = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]           = useState({ name: "", dni: "", phone: "" });
  const debounced                 = useDebounced(query);
  const search                    = useCustomerSearch(debounced);
  const create                    = useCreateCustomer();
  const inputRef                  = useRef<HTMLInputElement>(null);

  if (value) {
    const credit = Number(value.creditBalance ?? 0);
    return (
      <div className="flex items-center justify-between rounded-xl border border-primary bg-primary-container/20 px-3 py-2 text-sm">
        <span className="font-medium text-ink">
          {value.name}
          {credit > 0 && (
            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              ${credit.toLocaleString("es-AR")} a favor
            </span>
          )}
        </span>
        <button
          onClick={() => { onChange(null); setQuery(""); setShowCreate(false); }}
          className="text-ink-soft hover:text-ink ml-2"
          aria-label="Cambiar cliente"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        ref={inputRef}
        placeholder="Nombre, DNI o teléfono…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowCreate(false); }}
        autoFocus
      />

      {/* Resultados de búsqueda */}
      {debounced.length >= 2 && (
        <div className="rounded-xl border border-surface-highest bg-white shadow-md overflow-hidden">
          {search.isFetching && (
            <div className="px-3 py-2 text-xs text-ink-soft">Buscando…</div>
          )}
          {search.data?.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-low border-b border-surface-high last:border-0"
              onClick={() => { onChange(c); setQuery(""); }}
            >
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 text-xs text-ink-soft">
                {c.dni ? `DNI ${c.dni}` : ""}{c.phone ? ` · ${c.phone}` : ""}
              </span>
            </button>
          ))}
          {!search.isFetching && search.data?.length === 0 && (
            <div className="px-3 py-2 text-xs text-ink-soft">
              Sin resultados para "{debounced}"
            </div>
          )}
        </div>
      )}

      {/* Alta rápida */}
      {!showCreate ? (
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setShowCreate(true)}
        >
          + Crear cliente nuevo
        </button>
      ) : (
        <div className="rounded-xl border border-surface-high bg-surface-low p-3 space-y-2">
          <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Alta rápida</p>
          <Input
            label="Nombre *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="DNI *"
            inputMode="numeric"
            value={form.dni}
            onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })}
          />
          <Input
            label="Celular"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {create.error && <ErrorNote message={(create.error as Error).message} />}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() =>
                create.mutate(
                  { name: form.name, dni: form.dni, phone: form.phone || undefined },
                  { onSuccess: (c) => { onChange(c); setShowCreate(false); } },
                )
              }
              disabled={
                create.isPending || form.name.length < 2 || !/^\d{7,8}$/.test(form.dni)
              }
            >
              {create.isPending ? "Creando…" : "Crear y usar"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export type NewApptPrefill = {
  /**
   * Viene de hacer click en un hueco de la COLUMNA de una prestadora: queda
   * fija y el selector de servicio muestra solo los que ella ofrece. Desde el
   * botón "Nuevo turno" no se manda, y ahí se elige cualquier servicio y
   * después la prestadora que lo presta.
   */
  providerId?: string;
  providerName?: string;
  serviceId?: string;
  minutes?: number; // minutos desde medianoche ART
};

type Props = {
  open: boolean;
  date: string; // YYYY-MM-DD
  prefill: NewApptPrefill | null;
  onClose: () => void;
};

const EXPIRY_OPTIONS = [
  { value: 10,  label: "10 min" },
  { value: 15,  label: "15 min" },
  { value: 20,  label: "20 min" },
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hora" },
  { value: 90,  label: "1 h 30 min" },
];

/**
 * El día de un vencimiento, en dd/mm/aaaa.
 *
 * Se leen las partes UTC y NO se pasa por `toLocaleDateString`: la fecha viaja
 * como `2027-03-15T00:00:00Z`, y en Argentina —tres horas atrás— esa medianoche
 * cae a las 21:00 del 14. Formateando en hora local, un pack que vence el 15
 * se muestra venciendo el 14, y Laura le cobra a la clienta un día antes de lo
 * que corresponde.
 */
const fechaCorta = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
};

/**
 * Contra qué se descuenta este turno.
 *
 * Tres formas, y sólo una se ve por vez (reglas §3.8):
 *
 * - **Nada a favor** → no se muestra nada. Es el caso más común y un cartel
 *   diciendo "no tiene packs" sería ruido en todos los turnos normales.
 * - **Una sola compra** → se descuenta sola y se avisa cuál. No es un
 *   selector: no hay nada que elegir, sólo hay que enterarse. El link para
 *   soltarla existe por si Laura quiere cobrarlo aparte.
 * - **Varias** → elige Laura. Ordenadas por lo que vence antes, que es lo que
 *   está por perderse.
 */
function DescuentoDePack({
  estado,
  cargando,
  elegida,
  onElegir,
}: {
  estado: Consumible | undefined;
  cargando: boolean;
  elegida: string | null;
  onElegir: (purchaseServiceId: string | null) => void;
}) {
  if (cargando) {
    return <p className="text-xs text-ink-soft">Buscando qué tiene a favor…</p>;
  }
  if (!estado || estado.tipo === "ninguna") return null;

  if (estado.tipo === "automatica") {
    const { opcion } = estado;
    const vence = fechaCorta(opcion.venceEl);
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/8 px-3 py-2">
        {elegida === estado.purchaseServiceId ? (
          <>
            <p className="text-sm text-ink">
              Se descuenta de <strong>{opcion.descripcion}</strong>
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {opcion.disponibles === 1
                ? "Le queda 1 servicio a agendar"
                : `Le quedan ${opcion.disponibles} servicios a agendar`}
              {vence ? ` · vence el ${vence}` : ""}
            </p>
            <button
              type="button"
              onClick={() => onElegir(null)}
              className="mt-1 text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              No descontar: cobrar este turno aparte
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink">Este turno se cobra aparte.</p>
            <button
              type="button"
              onClick={() => onElegir(estado.purchaseServiceId)}
              className="mt-1 text-xs text-primary underline underline-offset-2"
            >
              Descontarlo de {opcion.descripcion}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-surface-highest bg-white px-3 py-2">
      <p className="text-xs font-medium text-ink-soft">
        Tiene {estado.opciones.length} cosas a favor para este servicio. ¿De cuál se descuenta?
      </p>
      {estado.opciones.map((o) => {
        const vence = fechaCorta(o.venceEl);
        return (
          <label
            key={o.purchaseId}
            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-low"
          >
            <input
              type="radio"
              name="descuento-de-pack"
              className="mt-1 accent-[var(--color-primary)]"
              checked={elegida === o.purchaseServiceId}
              onChange={() => onElegir(o.purchaseServiceId)}
            />
            <span className="text-sm text-ink">
              {o.descripcion}
              <span className="mt-0.5 block text-xs text-ink-soft">
                {o.disponibles === 1
                  ? "Le queda 1 servicio a agendar"
                  : `Le quedan ${o.disponibles} servicios a agendar`}
                {vence ? ` · vence el ${vence}` : ""}
              </span>
            </span>
          </label>
        );
      })}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-low">
        <input
          type="radio"
          name="descuento-de-pack"
          className="accent-[var(--color-primary)]"
          checked={elegida === null}
          onChange={() => onElegir(null)}
        />
        <span className="text-sm text-ink-soft">No descontar: cobrarlo aparte</span>
      </label>
    </div>
  );
}

export function NewAppointmentModal({ open, date, prefill, onClose }: Props) {
  const { data: services = [] } = useServices();

  const [customer,      setCustomer]     = useState<Customer | null>(null);
  const [serviceId,     setServiceId]    = useState(prefill?.serviceId ?? "");
  const [providerId,    setProviderId]   = useState(prefill?.providerId ?? "");
  const [timeStr,       setTimeStr]      = useState(
    prefill?.minutes != null ? minToTimeStr(prefill.minutes) : "09:00",
  );
  const [priceMode,     setPriceMode]    = useState<"list" | "cash">("list");
  const [notes,         setNotes]        = useState("");
  const [apptStatus,    setApptStatus]   = useState<"scheduled" | "reserved">("scheduled");
  const [expiryMinutes, setExpiryMinutes] = useState(60);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] =
    useState<"cash" | "bank_transfer" | "mercadopago" | "credit">("cash");

  // Saldo a favor del cliente elegido (viene de una seña de un turno que se
  // canceló antes de su horario). Se puede usar para pagar esta seña.
  const creditBalance = Number(customer?.creditBalance ?? 0);
  const seniaAmount = Number(depositAmount) || 0;
  const creditIsShort = depositMethod === "credit" && seniaAmount > creditBalance;

  // Si se cambia de cliente y el nuevo no tiene saldo, no dejar "Saldo a favor"
  // seleccionado (se enviaría un método impagable).
  if (depositMethod === "credit" && creditBalance <= 0) setDepositMethod("cash");

  // Alta desde la columna de una prestadora: queda fija y solo se ofrecen SUS
  // servicios. Desde "Nuevo turno" (sin prefill de prestadora) sigue el flujo
  // inverso: se elige el servicio y después quién lo presta.
  const lockedProviderId = prefill?.providerId ?? null;
  const { data: providerServices = [], isFetching: loadingProviderServices } =
    useServicesByProvider(lockedProviderId);

  const { data: providers = [], isFetching: loadingProviders } = useProvidersByService(
    serviceId || null,
  );

  const create = useCreateAppointment();

  // Qué tiene la clienta a favor para este servicio.
  const { data: consumible, isFetching: buscandoConsumible } = useConsumible(
    customer?.id ?? null,
    serviceId || null,
  );

  // Cuál se descuenta. `null` = ninguna, y es un estado distinto de "todavía no
  // decidí": por eso el sincronizado de abajo mira la firma de la respuesta y no
  // el valor, que si no, soltar el servicio elegido se pisaría solo en el render
  // siguiente.
  const [servicioElegido, setServicioElegido] = useState<string | null>(null);

  // La única compra se elige sola (reglas §3.8). Se ajusta DURANTE el render,
  // como el resto de este archivo, para no encadenar renders con un efecto.
  const firmaConsumible =
    consumible?.tipo === "automatica"
      ? `auto:${consumible.purchaseServiceId}`
      : consumible?.tipo === "elige_laura"
        ? `varias:${consumible.opciones.map((o) => o.purchaseServiceId).join(",")}`
        : "ninguna";
  // Arranca en `null` —un valor que ninguna firma real puede tener— para que la
  // primera pasada SIEMPRE sincronice. Inicializándolo con `firmaConsumible` se
  // rompía cuando la respuesta ya estaba en caché al montar: las dos firmas
  // nacían iguales, la selección automática no corría nunca y el turno se
  // guardaba sin descontar el servicio comprado, en silencio. Pasa de verdad al
  // reabrir la modal para la misma clienta y servicio.
  const [firmaSincronizada, setFirmaSincronizada] = useState<string | null>(null);
  if (firmaConsumible !== firmaSincronizada) {
    setFirmaSincronizada(firmaConsumible);
    setServicioElegido(consumible?.tipo === "automatica" ? consumible.purchaseServiceId : null);
  }

  // El reset del formulario al abrir lo da el MONTAJE: la modal se monta de cero
  // cada vez que se abre (ver DayViewPage/WeekViewPage), así los useState de arriba
  // toman el prefill directo. No hace falta un efecto que resetee el estado.

  // Al cambiar el servicio y cargar su lista de prestadoras, mantener la prestadora
  // del prefill (slot clickeado) si la ofrece; si no, caer en la primera. Se ajusta
  // DURANTE el render (patrón recomendado de React) en vez de un efecto, para no
  // disparar renders en cascada (B2).
  // Con la prestadora fija no se reasigna nunca (la eligió el usuario al clickear
  // su columna); los servicios que se ofrecen ya son los de ella.
  const providersSig = providers.map((p) => p.id).join(",");
  const [syncedProvidersSig, setSyncedProvidersSig] = useState(providersSig);
  if (!lockedProviderId && providersSig !== syncedProvidersSig) {
    setSyncedProvidersSig(providersSig);
    if (serviceId && providers.length > 0 && !providers.find((p) => p.id === providerId)) {
      setProviderId(providers[0]?.id ?? "");
    }
  }

  // Opciones del selector de servicio según de dónde se abrió la modal
  const serviceOptions = lockedProviderId ? providerServices : services;

  // Hora fin calculada automáticamente
  const selectedService  = serviceOptions.find((s) => s.id === serviceId);
  const durationMin      = selectedService?.estimatedDurationMinutes ?? 0;
  const endTimeStr       = durationMin > 0 ? addMinutesToTime(timeStr, durationMin) : "";

  const canSubmit =
    Boolean(customer) &&
    Boolean(serviceId) &&
    Boolean(providerId) &&
    timeStr.length === 5 &&
    // Pagar con saldo insuficiente lo rechaza el backend: no dejar ni intentarlo
    !creditIsShort &&
    !create.isPending;

  function handleSubmit() {
    if (!customer || !serviceId || !providerId) return;
    const seniaNum = Number(depositAmount);
    create.mutate(
      {
        customerId: customer.id,
        serviceId,
        providerId,
        start:         toArgentinaISO(date, timeStr),
        priceMode,
        notes:         notes || undefined,
        status:        apptStatus,
        expiryMinutes: apptStatus === "reserved" ? expiryMinutes : undefined,
        deposit:
          seniaNum > 0 ? { amount: seniaNum, method: depositMethod } : undefined,
        customerPurchaseServiceId: servicioElegido ?? undefined,
      },
      { onSuccess: onClose },
    );
  }

  const fieldClass =
    "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-surface-low disabled:text-ink-soft";

  const DAY_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const dow = date ? new Date(`${date}T12:00:00Z`).getUTCDay() : null;
  const dateLabel = dow !== null
    ? `${DAY_NAMES[dow]} ${date.split("-").reverse().join("/")}`
    : date;

  return (
    <Modal open={open} onClose={onClose} title="Nuevo turno">
      <div className="space-y-4">
        {/* Fecha del turno */}
        <div className="flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2">
          <span className="text-base">📅</span>
          <span className="text-sm font-medium text-primary">{dateLabel}</span>
        </div>

        {/* Cliente */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Cliente</label>
          <CustomerPicker value={customer} onChange={setCustomer} />
        </div>

        {/* Servicio */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Servicio</label>
          <select
            className={fieldClass}
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={Boolean(lockedProviderId) && loadingProviderServices}
          >
            <option value="">
              {lockedProviderId && loadingProviderServices
                ? "Cargando servicios…"
                : lockedProviderId && serviceOptions.length === 0
                  ? "Esta prestadora no tiene servicios asignados"
                  : "Seleccioná un servicio…"}
            </option>
            {serviceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.estimatedDurationMinutes ? ` (${s.estimatedDurationMinutes} min)` : ""}
              </option>
            ))}
          </select>

          {/* Contra qué se descuenta. Sólo aparece si tiene algo a favor. */}
          {customer && serviceId && (
            <div className="mt-2">
              <DescuentoDePack
                estado={consumible}
                cargando={buscandoConsumible}
                elegida={servicioElegido}
                onElegir={setServicioElegido}
              />
            </div>
          )}
        </div>

        {/* Prestadora */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Prestadora</label>
          {lockedProviderId ? (
            // Fija: se llegó desde su columna en la grilla
            <select className={fieldClass} value={lockedProviderId} disabled>
              <option value={lockedProviderId}>{prefill?.providerName ?? "Prestadora"}</option>
            </select>
          ) : (
            <select
              className={fieldClass}
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={!serviceId || loadingProviders}
            >
              <option value="">
                {!serviceId
                  ? "Primero seleccioná un servicio"
                  : loadingProviders
                    ? "Cargando…"
                    : "Seleccioná una prestadora…"}
              </option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Hora inicio + Hora fin */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-ink-soft">Hora inicio</label>
            <input
              type="time"
              className={fieldClass}
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Hora fin{" "}
              <span className="font-normal text-ink-soft/70">(según servicio)</span>
            </label>
            <input
              type="time"
              className={fieldClass}
              value={endTimeStr}
              readOnly
              disabled
            />
          </div>
        </div>

        {/* Precio */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Precio</label>
          <div className="flex gap-2">
            {(["list", "cash"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPriceMode(mode)}
                className={[
                  "flex-1 rounded-xl border py-2 text-sm transition-colors",
                  priceMode === mode
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-surface-highest text-ink-soft hover:bg-surface-low",
                ].join(" ")}
              >
                {mode === "list" ? "Lista" : "Efectivo"}
                {selectedService && (
                  <span className="ml-1 text-xs">
                    $
                    {(mode === "list"
                      ? selectedService.unitPriceList
                      : selectedService.unitPriceCash
                    )?.toLocaleString("es-AR") ?? "—"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Seña (opcional): se factura a ARCA y queda a favor del cliente */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Seña <span className="font-normal text-ink-soft/70">(opcional — se factura a ARCA)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              placeholder="$ 0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className={`${fieldClass} flex-1`}
            />
            <select
              value={depositMethod}
              onChange={(e) => setDepositMethod(e.target.value as typeof depositMethod)}
              disabled={!(Number(depositAmount) > 0)}
              className={`${fieldClass} flex-1`}
            >
              <option value="cash">Efectivo</option>
              <option value="bank_transfer">Transferencia</option>
              <option value="mercadopago">MercadoPago</option>
              {creditBalance > 0 && (
                <option value="credit">
                  Saldo a favor (${creditBalance.toLocaleString("es-AR")})
                </option>
              )}
            </select>
          </div>
          {creditBalance > 0 && depositMethod !== "credit" && (
            <button
              type="button"
              onClick={() => {
                setDepositMethod("credit");
                if (!(Number(depositAmount) > 0)) setDepositAmount(String(creditBalance));
              }}
              className="mt-1 text-xs text-primary hover:underline"
            >
              Usar el saldo a favor de {customer?.name} (${creditBalance.toLocaleString("es-AR")})
            </button>
          )}
          {depositMethod === "credit" && (
            <p
              className={`mt-1 text-xs ${creditIsShort ? "text-red-700" : "text-green-700"}`}
            >
              {creditIsShort
                ? `El saldo a favor es de $${creditBalance.toLocaleString("es-AR")}: no alcanza para una seña de $${seniaAmount.toLocaleString("es-AR")}.`
                : `Se descuentan $${seniaAmount.toLocaleString("es-AR")} del saldo a favor. No entra plata a caja ni se emite factura nueva (ya se facturó al cobrarse la seña original).`}
            </p>
          )}
        </div>

        {/* Estado: Turno confirmado vs Reserva temporal */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">Estado</label>
          <div className="flex gap-2">
            {(["scheduled", "reserved"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setApptStatus(s)}
                className={[
                  "flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors",
                  apptStatus === s
                    ? s === "reserved"
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-primary bg-primary/10 text-primary"
                    : "border-surface-highest text-ink-soft hover:bg-surface-low",
                ].join(" ")}
              >
                {s === "scheduled" ? "✓ Turno confirmado" : "⏳ Reserva temporal"}
              </button>
            ))}
          </div>

          {apptStatus === "reserved" && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <label className="mb-1.5 block text-xs font-medium text-amber-700">
                La reserva expira en…
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpiryMinutes(opt.value)}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      expiryMinutes === opt.value
                        ? "border-amber-500 bg-amber-500 text-white font-medium"
                        : "border-amber-200 bg-white text-amber-700 hover:border-amber-400",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-amber-600">
                Si no se confirma en ese tiempo, el turno se cancela automáticamente.
              </p>
            </div>
          )}
        </div>

        {/* Notas */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Notas <span className="font-normal">(opcional)</span>
          </label>
          <textarea
            className={`${fieldClass} resize-none`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Indicaciones especiales…"
          />
        </div>

        {/* Error 409 u otro */}
        {create.error && <ErrorNote message={(create.error as Error).message} />}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending ? "Guardando…" : "Confirmar turno"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
