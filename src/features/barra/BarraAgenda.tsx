import type { ReactNode } from "react";
import { ViewTabs } from "../../components/ViewTabs";
import { Spinner } from "../../components/ui";
import { useModoAgenda, type ModoAgenda } from "../../lib/modo-agenda";
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
 * Siempre en un solo renglón, para que el nav no le coma alto a la grilla: si
 * no entra, los textos se cortan y se leen enteros al pasar el mouse.
 */
export function BarraAgenda({ vista, fecha, cargando, buscador }: Props) {
  const [modo, setModo] = useModoAgenda();

  return (
    <div className="flex flex-nowrap items-center gap-2 shrink-0 min-w-0">
      <div className="shrink-0">{fecha}</div>

      {/* Lugar fijo para el spinner: que aparezca no corre nada. */}
      <span className="flex w-4 shrink-0 justify-center">{cargando && <Spinner />}</span>

      <div className="ml-auto flex min-w-0 flex-nowrap items-center gap-2">
        <div className="flex min-w-0 rounded-lg border border-surface-highest overflow-hidden text-sm">
          {MODOS.map((m) => (
            <button
              key={m.key}
              onClick={() => setModo(m.key)}
              title={m.label}
              className={[
                "min-w-10 truncate whitespace-nowrap px-3 py-1.5 transition-colors",
                modo === m.key
                  ? "bg-primary text-white font-medium"
                  : "bg-white text-ink-soft hover:bg-surface-low",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* El buscador cede ancho antes que los modos. */}
        <div className="min-w-20 shrink-[3]">{buscador}</div>

        {/* Qué significa cada fondo y cada color de la grilla */}
        <div className="shrink-0"><ReferenciasAgenda /></div>

        <ViewTabs current={vista} />
      </div>
    </div>
  );
}
