import { useNavigate } from "react-router-dom";

export type AgendaView = "dia" | "semana" | "mes";

const TABS: { key: AgendaView; label: string; path: string }[] = [
  { key: "dia",    label: "Día",    path: "/" },
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

  function handleClick(tab: (typeof TABS)[0]) {
    saveView(tab.key);
    navigate(tab.path);
  }

  return (
    <div className="flex rounded-lg border border-surface-highest overflow-hidden text-sm">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleClick(tab)}
          className={[
            "px-3 py-1.5 transition-colors",
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
