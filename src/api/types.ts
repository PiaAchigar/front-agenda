export type Category = {
  id: string;
  name: string | null;
  description: string | null;
  displayOrder: number | null;
  children: Category[];
};

export type Service = {
  id: string;
  name: string | null;
  description: string | null;
  unitPriceList: number | null;
  unitPriceCash: number | null;
  requiresOperator: boolean | null;
  requiresMachine: boolean | null;
  estimatedDurationMinutes: number | null;
  categories: { id: string; name: string | null }[];
};

export type SlotOption = {
  providerId: string;
  providerName: string;
  machineId: string | null;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  options: SlotOption[];
};

export type Availability = {
  date: string;
  serviceId: string;
  durationMinutes: number;
  slots: AvailabilitySlot[];
  reason?: "closed" | "no_providers";
};

export type Appointment = {
  id: string;
  appointmentStart: string;
  appointmentEnd: string;
  durationMinutes: number | null;
  servicePrice: number | null;
  status: string | null;
  reservationExpiresAt: string | null;
  notes: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  serviceId: string | null;
  serviceName: string | null;
  providerId: string | null;
  providerName: string | null;
  machineName: string | null;
  /** No nulo cuando el turno es de una ACTIVIDAD (Pilates, Thermo Bike...) */
  activityId: string | null;
  activityName: string | null;
  activityType: "class" | "machine" | null;
  /** No nulo cuando el turno es una inscripción a un encuentro de CAPACITACIÓN */
  trainingSessionId: string | null;
};

/**
 * Una clase que se dicta en una fecha: el EVENTO, no la inscripción de una
 * clienta. Existe aunque no se haya anotado nadie.
 *
 * Une dos orígenes con el mismo shape: actividades (patrón semanal de
 * activity_schedules) y capacitaciones (training_sessions, fechas concretas).
 */
export type ClassOccurrence = {
  occurrenceId: string;
  kind: "activity" | "training";
  /** activity_id o training_id según kind */
  subjectId: string;
  sessionId: string | null;
  name: string;
  activityType: "class" | "machine" | null;
  sessionNumber: number | null;
  totalSessions: number | null;
  providerId: string | null;
  providerName: string | null;
  machineId: string | null;
  machineName: string | null;
  location: string | null;
  /** "HH:MM" en hora local del negocio */
  startTime: string;
  endTime: string;
  /** Instante UTC de inicio (ISO) — clave para abrir las asistencias */
  startsAt: string;
  /** null = sin cupo declarado */
  capacity: number | null;
  enrolledCount: number;
  attendedCount: number;
};

/**
 * Un cliente en el roster de una clase. `canMark` en false = no tiene
 * suscripción activa a la actividad, así que no se le puede registrar
 * asistencia (activity_attendance cuelga de la suscripción).
 */
export type ClassRosterEntry = {
  appointmentId: string;
  customerId: string | null;
  customerName: string;
  subscriptionId: string | null;
  attended: boolean;
  canMark: boolean;
  reason: string | null;
};

export type Customer = {
  id: string;
  name: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
  /** Saldo a favor (viene como string decimal del backend, ej "12000.00"). */
  creditBalance?: string | null;
};

/** Servicio tal como lo devuelve `/providers/:id/services` (shape reducido). */
export type ProviderService = Pick<
  Service,
  "id" | "name" | "estimatedDurationMinutes" | "unitPriceList" | "unitPriceCash"
>;

export type Provider = {
  id: string;
  fullName: string | null;
  specialties: string | null;
};

export type CompanyConfig = {
  companyName: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  openHours: {
    dayOfWeek: number | null;
    openingTime: string | null;
    closingTime: string | null;
    isOpen: boolean | null;
  }[];
};

/**
 * Un movimiento del historial de un turno (`GET /appointments/:id/reschedules`).
 *
 * `rescheduledByName` viene de un LEFT JOIN por `users.auth_id` y suele ser
 * null: hoy casi ningún usuario tiene ese campo cargado. La fecha y el motivo
 * están siempre — que es lo que antes se perdía.
 */
export type Reschedule = {
  id: string;
  previousStart: string | null;
  previousEnd: string | null;
  newStart: string;
  newEnd: string;
  reason: string | null;
  createdAt: string;
  rescheduledByName: string | null;
};

/** Un insumo que quedó en negativo al completar un turno. */
export type InsumoFaltante = {
  productId: string;
  name: string | null;
  quantity: number;
  /** Lo que había antes. `null` = nadie lo había contado todavía. */
  stockAntes: number | null;
  stockDespues: number;
};

/** Un insumo de la receta que NO se descontó, y por qué. */
export type InsumoOmitido = {
  productId: string;
  name: string | null;
  motivo: "archivado" | "cantidad";
};

/**
 * Lo que devuelve completar un turno (1.44.0). Sólo viene en la transición a
 * 'completed': volver a completar un turno ya completado no descuenta nada y
 * no trae este campo.
 */
export type Consumo = {
  descontados: number;
  faltantes: InsumoFaltante[];
  omitidos: InsumoOmitido[];
};
