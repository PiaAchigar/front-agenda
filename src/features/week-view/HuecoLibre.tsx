import type { ProviderColor } from "../../lib/colors";

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Props = {
  minutos: number;
  providerName: string;
  color: ProviderColor | undefined;
  carril: number;
  total: number;
  top: number;
  alto: number;
  onElegir: () => void;
};

/**
 * Un lugar libre para el servicio buscado: botón con borde punteado del color
 * de la prestadora, en su carril dentro del día para no tapar a las otras.
 */
export function HuecoLibre({ minutos, providerName, color, carril, total, top, alto, onElegir }: Props) {
  return (
    <button
      type="button"
      onClick={onElegir}
      className="absolute overflow-hidden rounded border-2 border-dashed px-1 text-left text-[10px] font-medium leading-tight hover:brightness-95"
      style={{
        top,
        height: alto - 2,
        left: `calc(${(carril / total) * 100}% + 2px)`,
        width: `calc(${100 / total}% - 4px)`,
        zIndex: 15,
        backgroundColor: color?.bg ?? "#f1f5f9",
        color: color?.text ?? "#334155",
        borderColor: color?.text ?? "#94a3b8",
      }}
    >
      {hhmm(minutos)} {providerName}
    </button>
  );
}
