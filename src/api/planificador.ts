// Espejo de los tipos de `api-sistema-central/src/repositories/planificador.repo.ts`.

export type SesionPlanificable = {
  purchaseServiceId: string;
  vuelta: number; // customer_purchase_service.repeticion
  orden: number; // dentro de la vuelta, el orden del combo/promo (1..n)
  nombre: string;
  serviceId: string; // en depilación, el servicio ancla
  esDepilacion: boolean;
  zonas: string[]; // depilación: TODAS las del pack (sin las "a elección"); si no, []
  duracionMinutos: number; // servicio: su duración; depilación: minutosElegidos(zonas) para el sexo de la clienta
  juntos: boolean; // el combo de la línea está marcado "se hacen juntos"
};

export type BaseDelPlanificador = {
  compraId: string;
  customerId: string;
  clienta: string; // nombre para los textos
  descripcion: string;
  intervalo: { dias: number; cargado: boolean };
  venceEl: string | null; // YYYY-MM-DD, de la vigencia de la compra
  puerta: { total: number; pagado: number; minimo: number } | null; // sólo depilación
  turnosDeLaClienta: { start: string; end: string }[]; // futuros, no cancelados
  sesiones: SesionPlanificable[]; // libres, ordenadas por vuelta y orden
};
