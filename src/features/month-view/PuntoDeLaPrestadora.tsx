import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Appointment } from "../../api/types";
import type { ProviderColor } from "../../lib/colors";
import { formatTime } from "../../lib/format";

type Props = {
  /** `YYYY-MM-DD` del día de la celda, para identificar el punto. */
  dia: string;
  providerId: string;
  providerName: string;
  color: ProviderColor | undefined;
  /** Los turnos de esa prestadora ese día (ya filtrados: sin cancelados). */
  turnos: Appointment[];
};

const ANCHO_FICHA = 224; // w-56
const ALTO_FICHA_ESTIMADO = 100;
const MARGEN = 4;

/**
 * El puntito de color de una prestadora en una celda del mes. Al pasar el
 * mouse muestra una ficha con sus turnos del día, uno por línea
 * (`HH:MM · Clienta · Servicio`). Con el dedo no hay hover: el primer toque
 * muestra la ficha SIN ir al día (se frena el clic) y el segundo toque deja
 * pasar el clic a la celda, que lleva al día. Mismo patrón que `PastillaDeTurno`.
 */
export function PuntoDeLaPrestadora({ dia, providerId, providerName, color, turnos }: Props) {
  const [hover, setHover] = useState(false);
  const [armado, setArmado] = useState(false);
  const fueToque = useRef(false);
  const punto = useRef<HTMLSpanElement>(null);
  const fichaEl = useRef<HTMLDivElement>(null);
  const fichaId = useId();
  const ficha = hover || armado;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // La ficha vive en un portal (la celda y el scroll del mes la cortarían):
  // se ancla al punto y se corre para que entre en pantalla.
  useLayoutEffect(() => {
    if (!ficha) { setPos(null); return; }
    function acomodar() {
      const r = punto.current?.getBoundingClientRect();
      if (!r) return;
      const alto = fichaEl.current?.offsetHeight || ALTO_FICHA_ESTIMADO;
      const left = Math.max(MARGEN, Math.min(r.left, window.innerWidth - ANCHO_FICHA - MARGEN));
      const abajo = r.bottom + MARGEN;
      const top = abajo + alto > window.innerHeight ? Math.max(MARGEN, r.top - MARGEN - alto) : abajo;
      setPos({ top, left });
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
    // Se lee y se gasta, para que un clic sin pointerdown propio no herede el toque anterior.
    const esToque = fueToque.current;
    fueToque.current = false;
    if (esToque && !armado) {
      e.stopPropagation(); // no ir al día: es el primer toque
      setArmado(true);
      setHover(true);
    }
  }

  const ordenados = [...turnos].sort((a, b) => a.appointmentStart.localeCompare(b.appointmentStart));

  return (
    <>
      <span
        ref={punto}
        data-testid={`punto-${dia}-${providerId}`}
        aria-describedby={ficha ? fichaId : undefined}
        className="h-4 w-4 rounded-full"
        style={{ backgroundColor: color?.bg ?? "#cbd5e1", boxShadow: `inset 0 0 0 1px ${color?.text ?? "#94a3b8"}55` }}
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
          <p className="mb-1 font-semibold">{providerName}</p>
          {ordenados.map((t) => (
            <p key={t.id} data-testid="linea-de-turno">
              {formatTime(t.appointmentStart)} · {t.customerName ?? "Cliente"} · {t.serviceName}
            </p>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
