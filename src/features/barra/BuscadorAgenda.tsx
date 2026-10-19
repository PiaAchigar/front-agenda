import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useProviders, useServices } from "../../api/agenda";
import { sugerencias, useBusquedaAgenda, type Busqueda } from "../../lib/busqueda-agenda";

type Elegible = { tipo: "prestadora" | "servicio"; id: string; name: string };

/**
 * El buscador de la barra: se tipea el nombre de una prestadora o de un
 * servicio y la agenda se queda con eso. Elegido, muestra el nombre con una
 * x para quitar la búsqueda.
 */
export function BuscadorAgenda() {
  const idBase = useId();
  const [busqueda, elegir] = useBusquedaAgenda();
  const { data: provs = [] } = useProviders();
  const { data: servs = [] } = useServices();
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(-1);

  const prestadoras = useMemo(
    () => provs.map((p) => ({ id: p.id, name: p.fullName ?? "Sin nombre" })),
    [provs],
  );
  const servicios = useMemo(
    () => servs.map((s) => ({ id: s.id, name: s.name ?? "Sin nombre" })),
    [servs],
  );

  const grupos = useMemo(() => sugerencias(texto, prestadoras, servicios), [texto, prestadoras, servicios]);
  const opciones: Elegible[] = [
    ...grupos.prestadoras.map((o) => ({ ...o, tipo: "prestadora" as const })),
    ...grupos.servicios.map((o) => ({ ...o, tipo: "servicio" as const })),
  ];
  const listaAbierta = abierta && opciones.length > 0;
  const idOpcion = (i: number) => `${idBase}-op-${i}`;

  function cerrar() {
    setTexto("");
    setAbierta(false);
    setActiva(-1);
  }

  function aceptar(o: Elegible) {
    elegir({ tipo: o.tipo, id: o.id });
    cerrar();
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && opciones.length > 0) {
      e.preventDefault();
      setAbierta(true);
      setActiva((i) => (i + 1) % opciones.length);
    } else if (e.key === "ArrowUp" && opciones.length > 0) {
      e.preventDefault();
      setActiva((i) => (i <= 0 ? opciones.length - 1 : i - 1));
    } else if (e.key === "Enter" && listaAbierta) {
      e.preventDefault();
      aceptar(opciones[activa >= 0 ? activa : 0]!);
    } else if (e.key === "Escape") {
      cerrar();
    }
  }

  if (busqueda) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-primary bg-white pl-3 pr-1 py-1 text-sm">
        <span className="text-ink max-w-48 truncate">
          {nombreDe(busqueda, prestadoras, servicios)}
        </span>
        <button
          type="button"
          onClick={() => elegir(null)}
          aria-label="Quitar búsqueda"
          className="rounded p-0.5 text-ink-soft hover:bg-surface-low hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={listaAbierta}
        aria-controls={`${idBase}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={listaAbierta && activa >= 0 ? idOpcion(activa) : undefined}
        aria-label="Buscar prestadora o servicio"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierta(true);
          setActiva(-1);
        }}
        onKeyDown={alTeclear}
        onBlur={() => setAbierta(false)}
        placeholder="Buscar prestadora o servicio…"
        className="w-64 rounded-lg border border-surface-highest bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      {listaAbierta && (
        <div
          id={`${idBase}-lista`}
          role="listbox"
          // Que apretar una opción no le saque el foco al input antes del click.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute right-0 z-40 mt-1 w-64 max-h-72 overflow-auto rounded-lg border border-surface-highest bg-white py-1 shadow-lg"
        >
          {(
            [
              ["Prestadoras", grupos.prestadoras, 0],
              ["Servicios", grupos.servicios, grupos.prestadoras.length],
            ] as const
          ).map(
            ([titulo, lista, desde]) =>
              lista.length > 0 && (
                <div key={titulo} role="group" aria-label={titulo}>
                  <p className="px-3 pt-1 pb-0.5 text-[11px] font-semibold uppercase text-ink-soft">
                    {titulo}
                  </p>
                  {lista.map((o, i) => (
                    <div
                      key={o.id}
                      id={idOpcion(desde + i)}
                      role="option"
                      aria-selected={activa === desde + i}
                      onClick={() => aceptar(opciones[desde + i]!)}
                      className={[
                        "cursor-pointer px-3 py-1.5 text-sm text-ink",
                        activa === desde + i ? "bg-surface-low" : "hover:bg-surface-low",
                      ].join(" ")}
                    >
                      {o.name}
                    </div>
                  ))}
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}

function nombreDe(
  b: NonNullable<Busqueda>,
  prestadoras: { id: string; name: string }[],
  servicios: { id: string; name: string }[],
) {
  const lista = b.tipo === "prestadora" ? prestadoras : servicios;
  return lista.find((o) => o.id === b.id)?.name ?? "Búsqueda";
}
