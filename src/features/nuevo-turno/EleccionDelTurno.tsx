import type { Catalogo } from "../../api/ventas";
import { claveDeItem, pesos } from "../../lib/vender";
import {
  CLAVE_ACTIVIDADES_QUE_DICTA,
  CLAVE_CAPACITACIONES_QUE_DICTA,
  type EleccionDeQue,
  type GrupoDeQue,
  type LineaDisponible,
  type OfertaDeProveedora,
  areasDelTurno,
} from "../../lib/que-ofrecer";

const FIELD = "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const LABEL = "mb-1 block text-xs font-medium text-ink-soft";

/** El valor de un `<option>` de Qué (único entre grupos). */
export function claveDeEleccion(e: EleccionDeQue): string {
  if (e.tipo === "comprado") return `comprado:${e.linea.purchaseServiceId}`;
  if (e.tipo === "promo") return `promo:${e.promo.id}`;
  return claveDeItem(e.item);
}

function textoDe(e: EleccionDeQue): string {
  if (e.tipo === "comprado") return e.linea.texto;
  if (e.tipo === "promo") return e.promo.name ?? "Promo";
  return `${e.item.nombre} · desde ${pesos(e.item.precioDesde)}`;
}

const nombreDeLoMismo = (e: EleccionDeQue) =>
  e.tipo === "servicio" ? "servicio" : e.tipo === "combo" ? "combo" : "pack";

/**
 * Área, Qué y "¿Cuándo se cobra?" del Nuevo turno (spec 2026-10-19 §4).
 * Sólo dibuja y avisa: lo que cada cosa significa lo decide `lib/que-ofrecer`.
 */
export function EleccionDelTurno({
  catalogo,
  area,
  onArea,
  busqueda,
  onBusqueda,
  grupos,
  eleccion,
  onEleccion,
  cuando,
  onCuando,
  yaTiene,
  onElegirLinea,
  oferta = null,
  onIrAGrupales,
}: {
  catalogo: Catalogo | undefined;
  area: string;
  onArea: (clave: string) => void;
  busqueda: string;
  onBusqueda: (q: string) => void;
  grupos: GrupoDeQue[];
  eleccion: EleccionDeQue | null;
  onEleccion: (e: EleccionDeQue | null) => void;
  cuando: "ahora" | "en-el-turno";
  onCuando: (c: "ahora" | "en-el-turno") => void;
  /** Sesiones sin usar de lo mismo que se está por vender. */
  yaTiene: LineaDisponible[];
  onElegirLinea: (l: LineaDisponible) => void;
  /** Lo que ofrece la prestadora elegida: suma las áreas de lo que dicta en grupales. */
  oferta?: OfertaDeProveedora | null;
  /** Anotar en una actividad o capacitación que dicta: se hace en Turnos grupales. */
  onIrAGrupales?: (tipo: "actividad" | "capacitacion", id: string) => void;
}) {
  const areas = catalogo ? areasDelTurno(catalogo, oferta) : [];
  const grupal =
    area === CLAVE_ACTIVIDADES_QUE_DICTA
      ? { tipo: "actividad" as const, items: oferta?.actividades ?? [], cuales: "Las actividades" }
      : area === CLAVE_CAPACITACIONES_QUE_DICTA
        ? { tipo: "capacitacion" as const, items: oferta?.capacitaciones ?? [], cuales: "Las capacitaciones" }
        : null;
  const opciones = grupos.flatMap((g) => g.opciones);
  const valor = eleccion && opciones.some((o) => claveDeEleccion(o) === claveDeEleccion(eleccion)) ? claveDeEleccion(eleccion) : "";

  return (
    <>
      <label className="block">
        <span className={LABEL}>Área</span>
        <select aria-label="Área" className={FIELD} value={area} onChange={(e) => onArea(e.target.value)}>
          <option value="">Elegí un área…</option>
          {areas.map((a) => (
            <option key={a.clave} value={a.clave}>{a.nombre}</option>
          ))}
        </select>
      </label>

      {grupal ? (
        <div className="space-y-2">
          <p className="text-xs text-ink-soft">{grupal.cuales} se anotan desde Turnos grupales, con su cupo y sus encuentros.</p>
          <ul className="divide-y divide-surface-high rounded-xl border border-surface-highest bg-white">
            {grupal.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-ink">
                <span>{i.nombre}</span>
                <button
                  type="button"
                  aria-label={`Anotar en ${i.nombre}`}
                  onClick={() => onIrAGrupales?.(grupal.tipo, i.id)}
                  className="shrink-0 rounded-full border border-primary/50 px-3 py-1 text-xs font-medium text-primary-dark transition-colors hover:border-primary-dark hover:bg-primary-dark hover:text-white"
                >
                  Anotar en grupales
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
      <>
      {area && (
        <input aria-label="Buscar" placeholder="Buscar por nombre…" className={FIELD} value={busqueda} onChange={(e) => onBusqueda(e.target.value)} />
      )}
      <label className="block">
        <span className={LABEL}>Qué</span>
        <select
          aria-label="Qué"
          className={FIELD}
          disabled={!area}
          value={valor}
          onChange={(e) => onEleccion(opciones.find((o) => claveDeEleccion(o) === e.target.value) ?? null)}
        >
          <option value="">{area ? "Elegí qué…" : "Elegí un área primero"}</option>
          {grupos.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.opciones.map((o) => (
                <option key={claveDeEleccion(o)} value={claveDeEleccion(o)}>{textoDe(o)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      </>
      )}

      {eleccion && eleccion.tipo !== "comprado" && (
        <>
          {yaTiene.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p>
                Ya tiene este {nombreDeLoMismo(eleccion)} con {yaTiene.length} {yaTiene.length === 1 ? "sesión" : "sesiones"} sin usar. ¿Agendar una de esas?
              </p>
              {yaTiene.map((l) => (
                <button
                  key={l.purchaseServiceId}
                  type="button"
                  onClick={() => onElegirLinea(l)}
                  className="block w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-left text-sm hover:bg-amber-100"
                >
                  {l.texto}
                </button>
              ))}
            </div>
          )}
          <fieldset className="space-y-1">
            <legend className={LABEL}>¿Cuándo se cobra?</legend>
            <div className="flex gap-2">
              {(["ahora", "en-el-turno"] as const).map((c) => (
                <label
                  key={c}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    cuando === c ? "border-primary bg-primary/10 font-medium text-primary" : "border-surface-highest text-ink-soft"
                  }`}
                >
                  <input type="radio" name="cuando-se-cobra" checked={cuando === c} onChange={() => onCuando(c)} />
                  <span>{c === "ahora" ? "Ahora" : "En el turno"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </>
  );
}

