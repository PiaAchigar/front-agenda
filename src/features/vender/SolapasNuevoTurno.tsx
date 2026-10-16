export type ModoNuevoTurno = "agendar" | "vender";

const SOLAPAS: { modo: ModoNuevoTurno; texto: string }[] = [
  { modo: "agendar", texto: "Agendar" },
  { modo: "vender", texto: "Vender y agendar" },
];

/** Las dos solapas de "Nuevo turno" (spec 2026-10-16, decisión 2). */
export function SolapasNuevoTurno({ modo, onCambiar }: { modo: ModoNuevoTurno; onCambiar: (m: ModoNuevoTurno) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 rounded-full bg-surface-high p-1">
      {SOLAPAS.map((s) => (
        <button
          key={s.modo}
          type="button"
          role="tab"
          aria-selected={modo === s.modo}
          onClick={() => onCambiar(s.modo)}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            modo === s.modo ? "bg-white text-primary shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          {s.texto}
        </button>
      ))}
    </div>
  );
}
