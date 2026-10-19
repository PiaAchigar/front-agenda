import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProviders, useProvidersByService } from "../../api/agenda";
import { buildProviderColorMap } from "../../lib/colors";

/**
 * "La hacen:" — una pastilla por prestadora del servicio buscado, con su
 * color. Tocar una deja sólo a esa (`?con=`); tocarla de nuevo las vuelve a
 * mostrar a todas.
 */
export function QuienesLoHacen({ serviceId }: { serviceId: string }) {
  const [params, setParams] = useSearchParams();
  const { data: todas = [] } = useProviders();
  const { data: delServicio, isLoading } = useProvidersByService(serviceId);
  const colores = useMemo(() => buildProviderColorMap(todas.map((p) => p.id)), [todas]);
  const elegida = params.get("con");

  function alternar(id: string) {
    setParams(
      (actuales) => {
        const siguiente = new URLSearchParams(actuales);
        if (siguiente.get("con") === id) siguiente.delete("con");
        else siguiente.set("con", id);
        return siguiente;
      },
      { replace: true },
    );
  }

  if (isLoading || !delServicio) return null;
  if (delServicio.length === 0) {
    return <p className="shrink-0 text-sm text-ink-soft">Nadie tiene asignado este servicio todavía.</p>;
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-soft">La hacen:</span>
      {delServicio.map((p) => {
        const color = colores.get(p.id);
        const activa = elegida === p.id;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={activa}
            onClick={() => alternar(p.id)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-opacity",
              elegida && !activa ? "opacity-50" : "",
            ].join(" ")}
            style={{ backgroundColor: color?.bg, color: color?.text, borderColor: color?.text }}
          >
            {p.fullName}
          </button>
        );
      })}
    </div>
  );
}
