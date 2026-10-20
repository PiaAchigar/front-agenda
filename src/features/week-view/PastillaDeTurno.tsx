import { useEffect, useId, useRef, useState } from "react";
import type { Appointment } from "../../api/types";
import { STATUS_BORDER_COLOR, type ProviderColor } from "../../lib/colors";
import { formatTime } from "../../lib/format";
import { debeDelTurno } from "../../lib/deuda-del-turno";
import { pesos } from "../../lib/vender";

type Props = {
  turno: Appointment;
  color: ProviderColor | undefined;
  carril: number;
  total: number;
  top: number;
  alto: number;
  onAbrir: (turno: Appointment) => void;
};

function minutosRestantes(expiraEn: string): number {
  return Math.floor((new Date(expiraEn).getTime() - Date.now()) / 60_000);
}

/**
 * Un turno en la semana: una pastilla fina del color de la prestadora, con el
 * nombre de la clienta nada más. El resto (horario, prestadora, servicio) está
 * en la ficha que aparece al pasar el mouse o tomar el foco.
 */
export function PastillaDeTurno({ turno, color, carril, total, top, alto, onAbrir }: Props) {
  const [verFicha, setVerFicha] = useState(false);
  // Con el dedo no hay hover: el primer toque "arma" la pastilla (muestra la
  // ficha) y recién el segundo abre el turno.
  const [armada, setArmada] = useState(false);
  const fueToque = useRef(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const fichaId = useId();
  const ficha = verFicha || armada;

  useEffect(() => {
    if (!armada) return;
    function alTocarAfuera(e: PointerEvent) {
      if (contenedor.current?.contains(e.target as Node)) return;
      setArmada(false);
      setVerFicha(false);
    }
    document.addEventListener("pointerdown", alTocarAfuera);
    return () => document.removeEventListener("pointerdown", alTocarAfuera);
  }, [armada]);

  function alHacerClic() {
    // Se lee y se gasta: un clic sin pointerdown propio (Enter o Espacio) no
    // puede heredar el "fue toque" de una interacción anterior.
    const esToque = fueToque.current;
    fueToque.current = false;
    if (esToque && !armada) {
      setArmada(true);
      setVerFicha(true);
      return;
    }
    onAbrir(turno);
  }

  const reservada = turno.status === "reserved";
  const faltan = reservada && turno.reservationExpiresAt ? minutosRestantes(turno.reservationExpiresAt) : null;
  const debe = debeDelTurno(turno);
  const urgente = faltan !== null && faltan <= 10;
  const borde = STATUS_BORDER_COLOR[turno.status ?? "scheduled"] ?? STATUS_BORDER_COLOR.scheduled;

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
      onMouseEnter={() => setVerFicha(true)}
      onMouseLeave={() => setVerFicha(false)}
    >
      <button
        type="button"
        onPointerDown={(e) => { fueToque.current = e.pointerType === "touch"; }}
        onClick={alHacerClic}
        onFocus={() => setVerFicha(true)}
        onBlur={() => setVerFicha(false)}
        aria-describedby={ficha ? fichaId : undefined}
        className={[
          "h-full w-full overflow-hidden rounded px-1 text-left text-[10px] leading-tight shadow-sm",
          "transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary",
          reservada ? "border border-dashed border-amber-400" : "",
        ].join(" ")}
        style={{
          backgroundColor: reservada ? "#fffbeb" : (color?.bg ?? "#e5e7eb"),
          color: reservada ? "#92400e" : (color?.text ?? "#374151"),
          borderLeft: `3px solid ${borde}`,
        }}
      >
        <span className="flex items-center gap-0.5 truncate font-semibold">
          {reservada && <span className={urgente ? "text-red-500" : "text-amber-500"}>⏳</span>}
          <span className="truncate">{turno.customerName ?? "Cliente"}</span>
        </span>
      </button>

      {ficha && (
        <div
          id={fichaId}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-surface-high bg-white p-2 text-xs text-ink shadow-lg"
        >
          <p className="font-semibold">
            {formatTime(turno.appointmentStart)}–{formatTime(turno.appointmentEnd)}
          </p>
          <p>{turno.providerName}</p>
          <p>{turno.customerName ?? "Cliente"}</p>
          <p className="text-ink-soft">{turno.serviceName}</p>
          {debe !== null && <p className="font-semibold text-red-600">Debe {pesos(debe)}</p>}
          {reservada && faltan !== null && (
            <p className={urgente ? "text-red-600" : "text-amber-700"}>Reserva: expira en {faltan} min</p>
          )}
        </div>
      )}
    </div>
  );
}
