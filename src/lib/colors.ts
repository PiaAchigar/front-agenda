export type ProviderColor = {
  bg: string;
  text: string;
};

const PALETTE: ProviderColor[] = [
  { bg: "#fce7f3", text: "#be185d" }, // rosa
  { bg: "#dbeafe", text: "#1d4ed8" }, // azul
  { bg: "#dcfce7", text: "#15803d" }, // verde
  { bg: "#ffedd5", text: "#c2410c" }, // naranja
  { bg: "#ede9fe", text: "#7e22ce" }, // violeta
  { bg: "#fef9c3", text: "#92400e" }, // amarillo
  { bg: "#ccfbf1", text: "#0f766e" }, // teal
  { bg: "#fee2e2", text: "#b91c1c" }, // rojo suave
];

export function buildProviderColorMap(providerIds: string[]): Map<string, ProviderColor> {
  const map = new Map<string, ProviderColor>();
  providerIds.forEach((id, i) => {
    map.set(id, PALETTE[i % PALETTE.length]!);
  });
  return map;
}

// Borde izquierdo de la card según estado.
// scheduled-seña (naranja) queda pendiente hasta que exista el sub-estado.
export const STATUS_BORDER_COLOR: Record<string, string> = {
  reserved:  "#f59e0b", // ámbar
  scheduled: "#3b82f6", // azul
  completed: "#22c55e", // verde
  cancelled: "#9ca3af", // gris
  no_show:   "#ef4444", // rojo
};
