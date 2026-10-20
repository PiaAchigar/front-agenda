import type { Availability } from "../api/types";
import { yaPaso } from "./horario";

/** Un lugar libre: una prestadora puede atender a esa hora ese día. */
export type HuecoLibre = { dia: string; minutos: number; providerId: string; providerName: string; serviceId: string };

/**
 * Los huecos de un día: aplana `slots[].options[]` (un hueco por prestadora
 * posible en cada horario), saca los que ya pasaron y, si viene `soloDe`,
 * deja nada más que a esas prestadoras.
 */
export function huecosDelDia(
  av: Availability,
  dia: string,
  soloDe: string[] | null,
  ahora: Date = new Date(),
): HuecoLibre[] {
  const huecos: HuecoLibre[] = [];
  for (const slot of av.slots) {
    const [h = 0, m = 0] = slot.start.split(":").map(Number);
    const minutos = h * 60 + m;
    if (yaPaso(dia, minutos, ahora)) continue;
    for (const o of slot.options) {
      if (soloDe && !soloDe.includes(o.providerId)) continue;
      huecos.push({ dia, minutos, providerId: o.providerId, providerName: o.providerName, serviceId: av.serviceId });
    }
  }
  return huecos;
}
