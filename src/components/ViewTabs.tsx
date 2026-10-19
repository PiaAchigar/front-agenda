import { useNavigate, useSearchParams } from "react-router-dom";
import { useModoAgenda } from "../lib/modo-agenda";
import { rutaConservando } from "../lib/ruta-agenda";

export type AgendaView = "dia" | "semana" | "mes";

/** El día no tiene solapa: se llega con Turnos individuales / grupales. */
const TABS: { key: "semana" | "mes"; label: string; path: string }[] = [
  { key: "semana", label: "Semana", path: "/semana" },
  { key: "mes",    label: "Mes",    path: "/mes" },
];

export function saveView(view: AgendaView) {
  localStorage.setItem("agenda-view", view);
}

export function getSavedView(): AgendaView {
  return (localStorage.getItem("agenda-view") as AgendaView) ?? "dia";
}

export function ViewTabs({ current }: { current: AgendaView }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [modo] = useModoAgenda();
  // Las clases todavía sólo se ven por día.
  const deshabilitado = modo === "clases";

  function handleClick(tab: (typeof TABS)[number]) {
    if (deshabilitado) return;
    saveView(tab.key);
    navigate(rutaConservando(tab.path, searchParams));
  }

  return (
    <div className="flex rounded-lg border border-surface-highest overflow-hidden text-sm">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleClick(tab)}
          aria-current={current === tab.key ? "page" : undefined}
          aria-disabled={deshabilitado || undefined}
          title={deshabilitado ? "Por ahora las clases se ven por día" : undefined}
          className={[
            "px-3 py-1.5 transition-colors",
            deshabilitado
              ? "bg-white text-ink-soft/50 cursor-not-allowed"
              : current === tab.key
                ? "bg-primary text-white font-medium"
                : "bg-white text-ink-soft hover:bg-surface-low",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
