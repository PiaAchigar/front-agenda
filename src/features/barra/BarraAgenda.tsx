import { useEffect, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ViewTabs } from "../../components/ViewTabs";
import { Spinner } from "../../components/ui";
import { useModoAgenda, type ModoAgenda } from "../../lib/modo-agenda";
import { rutaConservando } from "../../lib/ruta-agenda";
import { ReferenciasAgenda } from "../referencias/ReferenciasAgenda";

const MODOS: { key: ModoAgenda; label: string }[] = [
  { key: "turnos", label: "Turnos individuales" },
  { key: "clases", label: "Turnos grupales" },
];

type Props = {
  vista: "dia" | "semana" | "mes";
  /** El control de fecha propio de cada vista (anterior · fecha · siguiente). */
  fecha: ReactNode;
  cargando?: boolean;
  /** Hueco para el buscador de la agenda. */
  buscador?: ReactNode;
};

/**
 * La barra de arriba, común al día, la semana y el mes:
 * fecha · Turnos individuales | grupales · buscador · referencias · Semana | Mes.
 * Envuelve a dos renglones si no entra.
 */
export function BarraAgenda({ vista, fecha, cargando, buscador }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [modo, setModo] = useModoAgenda();

  // Entrar a semana o mes es pedir turnos individuales: si quedó guardado el
  // modo grupal, se vuelve a individuales. Sólo al montar: tocar "Turnos
  // grupales" estando acá cambia el modo y salta al día, no debe deshacerse.
  useEffect(() => {
    if (vista !== "dia" && modo === "clases") setModo("turnos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegir(m: ModoAgenda) {
    setModo(m);
    // Las clases sólo se ven por día: desde semana o mes se salta al día.
    if (m === "clases" && vista !== "dia") navigate(rutaConservando("/dia", searchParams));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shrink-0">
      {fecha}
      <div className="flex flex-wrap items-center gap-2">
        {cargando && <Spinner />}

        <div className="flex rounded-lg border border-surface-highest overflow-hidden text-sm">
          {MODOS.map((m) => (
            <button
              key={m.key}
              onClick={() => elegir(m.key)}
              className={[
                "px-3 py-1.5 transition-colors",
                modo === m.key
                  ? "bg-primary text-white font-medium"
                  : "bg-white text-ink-soft hover:bg-surface-low",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>

        {buscador}

        {/* Qué significa cada fondo y cada color de la grilla */}
        {modo === "turnos" && <ReferenciasAgenda />}

        <ViewTabs current={vista} />
      </div>
    </div>
  );
}
