import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ClassOccurrence } from "../../api/types";
import { COLOR_DE_CLASE, estadoDeClase } from "../../lib/estado-de-clase";
import { pesos } from "../../lib/vender";

type Props = {
  clase: ClassOccurrence;
  ahora: Date;
  carril: number;
  total: number;
  top: number;
  alto: number;
  onAbrir: (clase: ClassOccurrence) => void;
};

const ANCHO_FICHA = 224; // w-56
const ALTO_FICHA_ESTIMADO = 140;
const MARGEN = 4;

/**
 * Una clase en la semana: nombre, horario y anotadas/cupo, del color de su
 * estado. La ficha con quiénes están anotadas aparece al pasar el mouse o
 * tomar el foco; tocar la pastilla lleva al día.
 */
export function PastillaDeClase({ clase, ahora, carril, total, top, alto, onAbrir }: Props) {
  const [ficha, setFicha] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const fichaEl = useRef<HTMLDivElement>(null);
  const fichaId = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // La ficha va fija sobre la pantalla (portal): la grilla la cortaría.
  useLayoutEffect(() => {
    if (!ficha) { setPos(null); return; }
    function acomodar() {
      const r = contenedor.current?.getBoundingClientRect();
      if (!r) return;
      const altoFicha = fichaEl.current?.offsetHeight || ALTO_FICHA_ESTIMADO;
      const left = Math.max(MARGEN, Math.min(r.left, window.innerWidth - ANCHO_FICHA - MARGEN));
      const abajo = r.bottom + MARGEN;
      setPos({ left, top: abajo + altoFicha > window.innerHeight ? Math.max(MARGEN, r.top - MARGEN - altoFicha) : abajo });
    }
    acomodar();
    window.addEventListener("scroll", acomodar, true);
    window.addEventListener("resize", acomodar);
    return () => {
      window.removeEventListener("scroll", acomodar, true);
      window.removeEventListener("resize", acomodar);
    };
  }, [ficha]);

  const estado = estadoDeClase(clase, ahora);
  const cupo = clase.capacity === null ? `${clase.enrolledCount} anotadas` : `${clase.enrolledCount}/${clase.capacity}`;
  const donde = [clase.providerName, clase.machineName].filter(Boolean).join(" · ");

  return (
    <div
      ref={contenedor}
      className="absolute"
      style={{
        top,
        height: alto,
        left: `calc(${(carril / total) * 100}% + 2px)`,
        width: `calc(${100 / total}% - 4px)`,
        zIndex: ficha ? 40 : 10,
      }}
      onMouseEnter={() => setFicha(true)}
      onMouseLeave={() => setFicha(false)}
    >
      <button
        type="button"
        data-estado={estado}
        onClick={() => onAbrir(clase)}
        onFocus={() => setFicha(true)}
        onBlur={() => setFicha(false)}
        aria-describedby={ficha ? fichaId : undefined}
        className={[
          "h-full w-full overflow-hidden rounded border-l-[3px] px-1 text-left text-[10px] leading-tight shadow-sm",
          "transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary",
          COLOR_DE_CLASE[estado].pastilla,
        ].join(" ")}
      >
        <span className="block truncate font-semibold">{clase.name}</span>
        <span className="block truncate">{clase.startTime}–{clase.endTime}</span>
        <span className="block truncate">{cupo}</span>
      </button>

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
                  {a.prueba && <span className="ml-1 font-semibold text-primary">Prueba</span>}
                  {a.debe > 0 && <span className="ml-1 font-semibold text-red-600">Debe {pesos(a.debe)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
