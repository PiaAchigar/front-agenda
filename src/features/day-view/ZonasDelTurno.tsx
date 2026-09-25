import type { DatosParaAgendar, Sexo, ZonaDelMenu } from "../../api/types";

/**
 * Qué se hace en esta sesión de depilación.
 *
 * El pack da un presupuesto de minutos y un menú; la clienta elige qué se hace
 * hoy. **El sobrante no se guarda:** si usa 39 de sus 60 minutos, la sesión se
 * gastó igual. El turno se arma con los minutos elegidos, no con el
 * presupuesto, así que la agenda bloquea lo que de verdad se usa.
 */
export function ZonasDelTurno({
  datos,
  elegidas,
  onCambio,
  onCambiarSexo,
}: {
  datos: DatosParaAgendar;
  elegidas: string[];
  onCambio: (ids: string[]) => void;
  onCambiarSexo?: (sexo: Sexo) => void;
}) {
  const porId = new Map(datos.zonas.map((z) => [z.id, z]));
  const usados = elegidas.reduce((t, id) => t + (porId.get(id)?.minutos ?? 0), 0);
  const quedan = datos.presupuestoMinutos - usados;

  // Una zona se puede tildar si está disponible Y entra en lo que queda. La ya
  // tildada nunca se bloquea: si no, se destilda y no se puede volver atrás.
  function estado(z: ZonaDelMenu): { puede: boolean; motivo: string | null } {
    if (elegidas.includes(z.id)) return { puede: true, motivo: null };
    if (!z.disponible) return { puede: false, motivo: z.motivo };
    if (z.minutos > quedan) {
      return {
        puede: false,
        motivo: `No entra en ${quedan === 1 ? "el minuto" : `los ${quedan} min`} que queda${quedan === 1 ? "" : "n"}`,
      };
    }
    return { puede: true, motivo: null };
  }

  function alternar(id: string) {
    onCambio(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id]);
  }

  return (
    <section aria-labelledby="zonas-del-turno">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="zonas-del-turno" className="text-sm font-semibold text-ink">
          {datos.nombreDelPack} · sesión {datos.sesion} de {datos.sesionesTotales}
        </h3>
        {onCambiarSexo && (
          <label className="text-xs text-ink-soft">
            Sexo{" "}
            <select
              className="rounded border border-surface-highest bg-surface-low px-2 py-1 text-xs"
              value={datos.sexo}
              onChange={(e) => onCambiarSexo(e.target.value as Sexo)}
            >
              <option value="mujer">Mujer</option>
              <option value="hombre">Hombre</option>
            </select>
          </label>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {datos.zonas.map((z) => {
          const { puede, motivo } = estado(z);
          return (
            <li key={z.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={elegidas.includes(z.id)}
                  disabled={!puede}
                  onChange={() => alternar(z.id)}
                />
                <span className={puede ? "text-ink" : "text-ink-soft"}>
                  {z.nombre}
                  <span className="ml-1.5 text-xs text-ink-soft tabular-nums">{z.minutos}</span>
                  {z.esDeRegalo && (
                    <span className="ml-1.5 text-xs text-emerald-700">de regalo</span>
                  )}
                  {/* El motivo va a la vista y no en un `title`: una casilla
                      gris sin explicación obliga a Laura a adivinar con la
                      clienta enfrente. */}
                  {motivo && <span className="block text-xs text-ink-soft">{motivo}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-surface-high pt-2 text-sm text-ink tabular-nums">
        {/* Un solo nodo de texto para "12 de 60 min": Testing Library sólo
            junta los hijos TEXT_NODE directos de un elemento (no atraviesa
            elementos anidados), así que partir esto en `{usados}` + " de "
            + `{presupuesto}` + " min" como hijos sueltos de <strong> nunca
            matchea un regex como /12 de 60 min/ — mismo problema que ya
            documentó `DescuentoDePack.test.tsx`. */}
        Elegidas: <strong>{`${usados} de ${datos.presupuestoMinutos} min`}</strong>
      </p>
    </section>
  );
}
