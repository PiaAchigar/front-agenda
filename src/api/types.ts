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
};

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
