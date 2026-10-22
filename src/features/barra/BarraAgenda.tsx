import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { saveView, ViewTabs } from "../../components/ViewTabs";
import { Spinner } from "../../components/ui";
import { todayLocal } from "../../lib/format";
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
 * fecha · Turnos individuales | grupales · buscador · referencias · Hoy · Semana | Mes.
 * Siempre en un solo renglón, para que el nav no le coma alto a la grilla: si
 * no entra, los textos se cortan y se leen enteros al pasar el mouse, y con la
 * barra angosta Semana y Mes pasan a ícono.
 */
export function BarraAgenda({ vista, fecha, cargando, buscador }: Props) {
  const [modo, setModo] = useModoAgenda();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Desde cualquier vista, al día de hoy: Laura vuelve a "lo que está pasando".
  function irAHoy() {
    saveView("dia");
    navigate(rutaConservando("/dia", searchParams, { date: todayLocal() }));
  }

  return (
    <div className="@container flex flex-nowrap items-center gap-2 shrink-0 min-w-0">
      <div className="shrink-0">{fecha}</div>

      {/* Lugar fijo para el spinner: que aparezca no corre nada. */}
      <span className="flex w-4 shrink-0 justify-center">{cargando && <Spinner />}</span>

      <div className="ml-auto flex min-w-0 flex-nowrap items-center gap-2">
        {/* Los modos no se recortan mientras el buscador pueda ceder; recién
            con la barra muy angosta (y Semana / Mes ya en ícono). */}
        <div className="flex min-w-0 shrink-0 @max-4xl:shrink rounded-lg border border-surface-highest overflow-hidden text-sm">
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

        <button
          type="button"
          onClick={irAHoy}
          title="Ir al día de hoy"
          className="shrink-0 whitespace-nowrap rounded-lg border border-surface-highest bg-white px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-low hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Hoy
        </button>

        <ViewTabs current={vista} />
      </div>
    </div>
  );
}
