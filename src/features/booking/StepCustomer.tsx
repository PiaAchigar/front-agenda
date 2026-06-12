import { useEffect, useState } from "react";
import { useCreateCustomer, useCustomerSearch } from "../../api/agenda";
import type { Customer } from "../../api/types";
import { Button, Card, ErrorNote, Input, Spinner } from "../../components/ui";

function useDebounced(value: string, ms = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function StepCustomer({ onSelect }: { onSelect: (customer: Customer) => void }) {
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", dni: "", phone: "", email: "" });
  const debouncedQuery = useDebounced(query);
  const search = useCustomerSearch(debouncedQuery);
  const create = useCreateCustomer();

  const submitNew = () => {
    create.mutate(
      {
        name: form.name,
        dni: form.dni,
        phone: form.phone || undefined,
        email: form.email || undefined,
      },
      { onSuccess: onSelect },
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Input
        label="Buscar cliente por nombre, DNI o teléfono"
        placeholder="Ej: María García o 30123456"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {search.isFetching && <Spinner />}
      {search.data?.map((customer) => (
        <Card key={customer.id} className="transition-shadow hover:shadow-md">
          <button className="w-full text-left" onClick={() => onSelect(customer)}>
            <p className="font-medium">{customer.name}</p>
            <p className="text-xs text-ink-soft">
              DNI {customer.dni ?? "—"} · {customer.phone ?? "sin teléfono"}
            </p>
          </button>
        </Card>
      ))}
      {debouncedQuery.length >= 2 && search.data?.length === 0 && (
        <p className="text-sm text-ink-soft">Sin resultados para “{debouncedQuery}”.</p>
      )}

      {!showNew ? (
        <Button variant="secondary" onClick={() => setShowNew(true)}>
          + Cliente nuevo
        </Button>
      ) : (
        <Card className="space-y-3">
          <h4 className="font-medium">Alta rápida</h4>
          <Input
            label="Nombre y apellido *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="DNI *"
            value={form.dni}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })}
          />
          <Input
            label="Celular"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {create.error && <ErrorNote message={(create.error as Error).message} />}
          <div className="flex gap-2">
            <Button
              onClick={submitNew}
              disabled={create.isPending || form.name.length < 2 || !/^\d{7,8}$/.test(form.dni)}
            >
              {create.isPending ? "Creando…" : "Crear y usar"}
            </Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
