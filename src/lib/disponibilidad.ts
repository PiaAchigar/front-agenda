export type OpcionesDeDisponibilidad = {
  providerId?: string;
  /** El turno que se está reagendando: su propio hueco cuenta como libre. */
  excludeAppointmentId?: string;
};

export function disponibilidadUrl(
  serviceId: string,
  date: string,
  opts: OpcionesDeDisponibilidad = {},
): string {
  const q = new URLSearchParams({ date });
  if (opts.providerId) q.set("providerId", opts.providerId);
  if (opts.excludeAppointmentId) q.set("excludeAppointmentId", opts.excludeAppointmentId);
  return `/api/agenda/availability/${serviceId}?${q.toString()}`;
}

export function disponibilidadDelMesUrl(
  serviceId: string,
  providerId: string,
  month: string,
  excludeAppointmentId?: string,
): string {
  const q = new URLSearchParams({ providerId, month });
  if (excludeAppointmentId) q.set("excludeAppointmentId", excludeAppointmentId);
  return `/api/agenda/availability/${serviceId}/month?${q.toString()}`;
}
