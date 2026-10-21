import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useProviders, useServices } from "../../api/agenda";
import { useActividades, useCapacitaciones } from "../../api/grupal";
import { sugerencias, useBusquedaAgenda } from "../../lib/busqueda-agenda";
import { useBusquedaGrupal } from "../../lib/busqueda-grupal";
import { useModoAgenda } from "../../lib/modo-agenda";

type Opcion = { id: string; name: string };
type Grupo<T extends string> = { titulo: string; tipo: T; lista: Opcion[] };

/**
 * El buscador de la barra. Es el mismo en los dos modos (mismo input, mismas
 * clases, mismo ancho); cambia qué busca: en "turnos", prestadoras y
 * servicios; en "clases", actividades y capacitaciones. Cada modo es su
 * componente para que los hooks de uno no corran en el otro.
 */
export function BuscadorAgenda() {
  const [modo] = useModoAgenda();
  return modo === "clases" ? <BuscadorGrupal /> : <BuscadorIndividual />;
}

function BuscadorIndividual() {
  const { agregar } = useBusquedaAgenda();
  const { data: provs = [] } = useProviders();
  const { data: servs = [] } = useServices();
  const prestadoras = useMemo(
    () => provs.map((p) => ({ id: p.id, name: p.fullName ?? "Sin nombre" })),
    [provs],
  );
  const servicios = useMemo(
    () => servs.map((s) => ({ id: s.id, name: s.name ?? "Sin nombre" })),
    [servs],
  );
  return (
    <CajaDeBusqueda
      etiqueta="Buscar prestadora o servicio"
      listas={[prestadoras, servicios]}
      titulos={["Prestadoras", "Servicios"]}
      tipos={["prestadora", "servicio"] as const}
      onElegir={agregar}
    />
  );
}

function BuscadorGrupal() {
  const { agregar } = useBusquedaGrupal();
  const { data: acts = [] } = useActividades();
  const { data: caps = [] } = useCapacitaciones();
  return (
    <CajaDeBusqueda
      etiqueta="Buscar actividad o capacitación"
      listas={[acts, caps]}
      titulos={["Actividades", "Capacitaciones"]}
      tipos={["actividad", "capacitacion"] as const}
      onElegir={agregar}
    />
  );
}

/**
 * El input con su lista de sugerencias. El buscador nunca cambia: elegir no lo
 * reemplaza por un chip, sigue vacío para sumar otro (los chips viven en
 * `FiltrosAgenda`, la fila de abajo).
 */
function CajaDeBusqueda<T extends string>({
  etiqueta,
  listas,
  titulos,
  tipos,
  onElegir,
}: {
  etiqueta: string;
  listas: readonly [Opcion[], Opcion[]];
  titulos: readonly [string, string];
  tipos: readonly [T, T];
  onElegir: (tipo: T, id: string) => void;
}) {
  const idBase = useId();
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(-1);

  const [primera, segunda] = listas;
  const sug = useMemo(() => sugerencias(texto, primera, segunda), [texto, primera, segunda]);
  const grupos: Grupo<T>[] = [
    { titulo: titulos[0], tipo: tipos[0], lista: sug.prestadoras },
    { titulo: titulos[1], tipo: tipos[1], lista: sug.servicios },
  ];
  const opciones = grupos.flatMap((g) => g.lista.map((o) => ({ ...o, tipo: g.tipo })));
  const listaAbierta = abierta && opciones.length > 0;
  const idOpcion = (i: number) => `${idBase}-op-${i}`;

  function cerrar() {
    setTexto("");
    setAbierta(false);
    setActiva(-1);
  }

  function aceptar(o: { tipo: T; id: string }) {
    onElegir(o.tipo, o.id);
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

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={listaAbierta}
        aria-controls={`${idBase}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={listaAbierta && activa >= 0 ? idOpcion(activa) : undefined}
        aria-label={etiqueta}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierta(true);
          setActiva(-1);
        }}
        onKeyDown={alTeclear}
        onBlur={() => setAbierta(false)}
        placeholder={`${etiqueta}…`}
        title={etiqueta}
        className="w-64 max-w-full min-w-0 text-ellipsis rounded-lg border border-surface-highest bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      {listaAbierta && (
        <div
          id={`${idBase}-lista`}
          role="listbox"
          // Que apretar una opción no le saque el foco al input antes del click.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute right-0 z-40 mt-1 w-64 max-h-72 overflow-auto rounded-lg border border-surface-highest bg-white py-1 shadow-lg"
        >
          {grupos.map(
            ({ titulo, lista }, g) =>
              lista.length > 0 && (
                <div key={titulo} role="group" aria-label={titulo}>
                  <p className="px-3 pt-1 pb-0.5 text-[11px] font-semibold uppercase text-ink-soft">
                    {titulo}
                  </p>
                  {lista.map((o, i) => {
                    const desde = g === 0 ? 0 : grupos[0]!.lista.length;
                    return (
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
                    );
                  })}
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}
