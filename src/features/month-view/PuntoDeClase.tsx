import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ClassOccurrence } from "../../api/types";
import { COLOR_DE_CLASE, ESTILO_DEBE, type EstadoDeClase } from "../../lib/estado-de-clase";
import { Badge } from "../../components/ui";
import { pesos } from "../../lib/vender";

type Props = { clase: ClassOccurrence; estado: EstadoDeClase };

const ANCHO_FICHA = 224; // w-56
const ALTO_FICHA_ESTIMADO = 120;
const MARGEN = 4;

/**
 * El puntito de una clase en una celda del mes, del color de su estado. Al
 * pasar el mouse muestra una ficha con la clase y quiénes están anotadas. Con
 * el dedo el primer toque muestra la ficha SIN ir al día y el segundo deja
 * pasar el clic a la celda. Mismo patrón que `PuntoDeLaPrestadora`.
 */
export function PuntoDeClase({ clase, estado }: Props) {
  const [hover, setHover] = useState(false);
  const [armado, setArmado] = useState(false);
  const fueToque = useRef(false);
  const punto = useRef<HTMLSpanElement>(null);
  const fichaEl = useRef<HTMLDivElement>(null);
  const fichaId = useId();
  const ficha = hover || armado;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!ficha) { setPos(null); return; }
    function acomodar() {
      const r = punto.current?.getBoundingClientRect();
      if (!r) return;
      const alto = fichaEl.current?.offsetHeight || ALTO_FICHA_ESTIMADO;
      const left = Math.max(MARGEN, Math.min(r.left, window.innerWidth - ANCHO_FICHA - MARGEN));
      const abajo = r.bottom + MARGEN;
      setPos({ left, top: abajo + alto > window.innerHeight ? Math.max(MARGEN, r.top - MARGEN - alto) : abajo });
    }
    acomodar();
    window.addEventListener("scroll", acomodar, true);
    window.addEventListener("resize", acomodar);
    return () => {
      window.removeEventListener("scroll", acomodar, true);
      window.removeEventListener("resize", acomodar);
    };
  }, [ficha]);

  useEffect(() => {
    if (!armado) return;
    function alTocarAfuera(e: PointerEvent) {
      if (punto.current?.contains(e.target as Node)) return;
      setArmado(false);
      setHover(false);
    }
    document.addEventListener("pointerdown", alTocarAfuera);
    return () => document.removeEventListener("pointerdown", alTocarAfuera);
  }, [armado]);

  function alHacerClic(e: React.MouseEvent) {
    const esToque = fueToque.current;
    fueToque.current = false;
    if (esToque && !armado) {
      e.stopPropagation(); // primer toque: sólo muestra la ficha
      setArmado(true);
      setHover(true);
    }
  }

  const cupo = clase.capacity === null ? `${clase.enrolledCount} anotadas` : `${clase.enrolledCount}/${clase.capacity}`;
  const donde = [clase.providerName, clase.machineName].filter(Boolean).join(" · ");

  return (
    <>
      <span
        ref={punto}
        data-testid={`punto-${clase.occurrenceId}`}
        data-estado={estado}
        aria-describedby={ficha ? fichaId : undefined}
        className={`h-3.5 w-3.5 rounded-full ${COLOR_DE_CLASE[estado].barra}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onPointerDown={(e) => { fueToque.current = e.pointerType === "touch"; }}
        onClick={alHacerClic}
      />
      {ficha && createPortal(
        <div
          ref={fichaEl}
          id={fichaId}
          role="tooltip"
          className="pointer-events-none fixed z-50 w-56 rounded-lg border border-surface-high bg-white p-2 text-xs text-ink shadow-lg"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0 }}
        >
          <p className="font-semibold">{clase.name}</p>
          <p>{clase.startTime}–{clase.endTime} · {cupo}</p>
          {donde && <p className="text-ink-soft">{donde}</p>}
          {clase.anotadas.length === 0 ? (
            <p className="mt-1 text-ink-soft">Nadie anotada.</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {clase.anotadas.map((a) => (
                <li key={a.appointmentId}>
                  {a.nombre ?? "Sin nombre"}
                  {a.prueba && <span className="ml-1"><Badge tone="primary">Prueba</Badge></span>}
                  {a.debe > 0 && <span className={`ml-1 ${ESTILO_DEBE}`}>Debe {pesos(a.debe)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
