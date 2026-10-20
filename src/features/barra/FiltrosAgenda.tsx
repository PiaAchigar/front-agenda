import { useMemo } from "react";
import { X } from "lucide-react";
import { useProviders, useProvidersByServices, useServices } from "../../api/agenda";
import { buildProviderColorMap, type ProviderColor } from "../../lib/colors";
import { useBusquedaAgenda } from "../../lib/busqueda-agenda";

/**
 * La segunda fila de la barra: los filtros elegidos en el buscador, un chip
 * por cada uno con su "×". Siempre está, también vacía, y siempre mide lo
 * mismo: si hay muchos chips scrollea hacia el costado en vez de envolver,
 * así la grilla de abajo no salta.
 *
 * Con algún servicio elegido suma "La hacen:" con las prestadoras que lo
 * hacen y todavía no están elegidas; tocar una la agrega como filtro.
 */
export function FiltrosAgenda() {
  const { busqueda, agregar, quitar } = useBusquedaAgenda();
  const { data: provs = [] } = useProviders();
  const { data: servs = [] } = useServices();
  const { porServicio, cargando } = useProvidersByServices(busqueda.servicios);
  const colores = useMemo(() => buildProviderColorMap(provs.map((p) => p.id)), [provs]);

  const nombreDe = (id: string) => provs.find((p) => p.id === id)?.fullName ?? "Prestadora";
  const servicioDe = (id: string) => servs.find((s) => s.id === id)?.name ?? "Servicio";

  // Las que hacen algún servicio elegido, sin repetir y en el orden en que llegan.
  const queLoHacen = [
    ...new Map(busqueda.servicios.flatMap((id) => porServicio.get(id) ?? []).map((p) => [p.id, p])).values(),
  ];
  const paraSumar = queLoHacen.filter((p) => !busqueda.prestadoras.includes(p.id));
  const hayFiltros = busqueda.prestadoras.length + busqueda.servicios.length > 0;

  return (
    <div
      data-testid="filtros-agenda"
      className="flex h-9 shrink-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap text-sm"
    >
      {!hayFiltros && (
        <span className="text-ink-soft/80">Elegí una prestadora o un servicio en el buscador para filtrar</span>
      )}

      {busqueda.prestadoras.map((id) => (
        <Chip
          key={`p-${id}`}
          nombre={nombreDe(id)}
          color={colores.get(id)}
          onQuitar={() => quitar("prestadora", id)}
        />
      ))}
      {busqueda.servicios.map((id) => (
        <Chip key={`s-${id}`} nombre={servicioDe(id)} onQuitar={() => quitar("servicio", id)} />
      ))}

      {busqueda.servicios.length > 0 && !cargando && queLoHacen.length === 0 && (
        <span className="shrink-0 text-ink-soft">Nadie tiene asignado este servicio todavía.</span>
      )}
      {paraSumar.length > 0 && (
        <>
          <span className="shrink-0 text-ink-soft">La hacen:</span>
          {paraSumar.map((p) => {
            const color = colores.get(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => agregar("prestadora", p.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-surface-highest bg-white px-2.5 py-0.5 text-xs text-ink-soft hover:bg-surface-low hover:text-ink"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color?.text ?? "#94a3b8" }}
                />
                {p.fullName}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

function Chip({ nombre, color, onQuitar }: { nombre: string; color?: ProviderColor; onQuitar: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary bg-white py-0.5 pl-2.5 pr-1 text-xs text-ink">
      {color && (
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.text }} />
      )}
      <span className="max-w-48 truncate">{nombre}</span>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${nombre}`}
        className="rounded-full p-0.5 text-ink-soft hover:bg-surface-low hover:text-ink"
      >
        <X size={12} />
      </button>
    </span>
  );
}
