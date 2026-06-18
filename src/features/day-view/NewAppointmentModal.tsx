import { useEffect, useRef, useState } from "react";
import {
  useCreateAppointment,
  useCreateCustomer,
  useCustomerSearch,
  useProvidersByService,
  useServices,
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
    return (
      <div className="flex items-center justify-between rounded-xl border border-primary bg-primary-container/20 px-3 py-2 text-sm">
        <span className="font-medium text-ink">{value.name}</span>
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
  providerId?: string;
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

  const { data: providers = [], isFetching: loadingProviders } = useProvidersByService(
    serviceId || null,
  );

  const create = useCreateAppointment();

  // Cuando cambia el prefill (nuevo slot clickeado), sincronizar
  useEffect(() => {
    if (!open) return;
    setCustomer(null);
    setServiceId(prefill?.serviceId ?? "");
    setProviderId(prefill?.providerId ?? "");
    setTimeStr(prefill?.minutes != null ? minToTimeStr(prefill.minutes) : "09:00");
    setPriceMode("list");
    setNotes("");
    setApptStatus("scheduled");
    setExpiryMinutes(60);
    create.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cuando cambia el servicio, limpiar la prestadora (a menos que el prefill ya la tenga y siga disponible)
  useEffect(() => {
    if (!serviceId) { setProviderId(""); return; }
    if (providers.length > 0 && !providers.find((p) => p.id === providerId)) {
      setProviderId(providers[0]?.id ?? "");
    }
  }, [serviceId, providers, providerId]);

  // Hora fin calculada automáticamente
  const selectedService  = services.find((s) => s.id === serviceId);
  const durationMin      = selectedService?.estimatedDurationMinutes ?? 0;
  const endTimeStr       = durationMin > 0 ? addMinutesToTime(timeStr, durationMin) : "";

  const canSubmit =
    Boolean(customer) &&
    Boolean(serviceId) &&
    Boolean(providerId) &&
    timeStr.length === 5 &&
    !create.isPending;

  function handleSubmit() {
    if (!customer || !serviceId || !providerId) return;
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
          >
            <option value="">Seleccioná un servicio…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.estimatedDurationMinutes ? ` (${s.estimatedDurationMinutes} min)` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Prestadora */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Prestadora</label>
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
