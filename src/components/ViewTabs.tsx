import { useNavigate, useSearchParams } from "react-router-dom";
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

  function handleClick(tab: (typeof TABS)[number]) {
    saveView(tab.key);
    navigate(rutaConservando(tab.path, searchParams));
  }

  return (
    <div className="flex shrink-0 rounded-lg border border-surface-highest overflow-hidden text-sm">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleClick(tab)}
          aria-current={current === tab.key ? "page" : undefined}
          title={tab.label}
          className={[
            "min-w-0 truncate whitespace-nowrap px-3 py-1.5 transition-colors",
            current === tab.key
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
